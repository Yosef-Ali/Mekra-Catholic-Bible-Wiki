/**
 * Extract and seed specific missing pages directly to the correct book.
 *
 * These pages were processed by the harness but db_action was empty (sync never ran).
 * This script extracts verse text via Gemini Vision, assigns to the correct book
 * (overriding page_map), and applies structure from existing structure files.
 *
 * Usage:
 *   pnpm tsx scripts/extract-missing-pages.ts              # dry run
 *   pnpm tsx scripts/extract-missing-pages.ts --live       # apply
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and } from 'drizzle-orm';
import { extractPage } from './test-vision';

const STRUCT_DIR = path.join(process.cwd(), 'extraction_output');

// Pages to extract and their CORRECT book assignment
// (the page_map wrongly maps some of these to adjacent books)
const PAGES: Array<{
  page: number;
  correctBook: string;
  expectedChapters: number[];
}> = [
  { page: 186, correctBook: '1 Kings',  expectedChapters: [20, 21] },
  { page: 331, correctBook: 'Psalms',   expectedChapters: [53, 54, 55, 56, 57] },
];

interface Subtitle { text: string; before_verse: number }
interface ChStruct {
  chapter: number;
  subtitles: Subtitle[];
  paragraph_breaks: number[];
  poetry_ranges: Array<[number, number]>;
}

function loadStructure(page: number): Map<number, ChStruct> {
  const result = new Map<number, ChStruct>();
  const file = path.join(STRUCT_DIR, `structure_page_${page}.json`);
  if (!fs.existsSync(file)) return result;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const ch of data.chapters || []) {
      result.set(ch.chapter, ch);
    }
  } catch { /* skip */ }
  return result;
}

// Also load structure from adjacent pages (for chapters spanning pages)
function loadStructureForChapter(targetBook: string, chapter: number): ChStruct | undefined {
  // Search all structure files for this chapter
  const files = fs.readdirSync(STRUCT_DIR).filter(f => /^structure_page_\d+\.json$/.test(f));
  const merged: ChStruct = { chapter, subtitles: [], paragraph_breaks: [], poetry_ranges: [] };
  let found = false;

  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(STRUCT_DIR, f), 'utf-8'));
    for (const ch of data.chapters || []) {
      if (ch.chapter === chapter) {
        found = true;
        const breakSet = new Set(merged.paragraph_breaks);
        for (const b of ch.paragraph_breaks || []) breakSet.add(b);
        merged.paragraph_breaks = Array.from(breakSet).sort((a, b) => a - b);

        const subMap = new Map(merged.subtitles.map((s: Subtitle) => [s.before_verse, s.text]));
        for (const s of ch.subtitles || []) {
          if (s?.text && !subMap.has(s.before_verse)) {
            merged.subtitles.push(s);
            subMap.set(s.before_verse, s.text);
          }
        }
        for (const r of ch.poetry_ranges || []) {
          if (Array.isArray(r) && r.length === 2) merged.poetry_ranges.push(r);
        }
      }
    }
  }
  return found ? merged : undefined;
}

function buildDBContent(
  verses: Array<{ verse_number: number; text: string }>,
  struct: ChStruct | undefined
) {
  const breakSet = new Set(struct?.paragraph_breaks || []);

  const dbVerses = verses.map(v => ({
    verse_number: v.verse_number,
    text: v.text,
    is_new_paragraph: v.verse_number === 1 || breakSet.has(v.verse_number - 1),
    indent: 0,
  }));

  const content = {
    sections: [{
      type: 'prose',
      subtitle_level: 'single',
      subtitle_text: '',
      verses: dbVerses,
    }],
  };

  const subtitles = (struct?.subtitles || [])
    .filter((s: Subtitle) => s?.text)
    .sort((a: Subtitle, b: Subtitle) => a.before_verse - b.before_verse)
    .map((s: Subtitle) => ({ verse: s.before_verse, text: s.text }));

  const paragraphBreaks = struct?.paragraph_breaks?.sort((a: number, b: number) => a - b) || [];
  const hasPoetry = (struct?.poetry_ranges?.length || 0) > 0;
  const poetrySections = (struct?.poetry_ranges || []).map(([s, e]) => ({
    verseRange: [s, e], type: 'poetry', indent: 1,
  }));

  const formattingRules = { subtitles, paragraphBreaks, hasPoetry, sections: poetrySections };
  const style = hasPoetry ? 'mixed' : 'rich';

  return { content, formattingRules, style };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const live = process.argv.includes('--live');
  console.log(`Mode: ${live ? '🚨 LIVE' : 'DRY RUN'}\n`);

  const allBooks = await db.select().from(books);
  const nameToId = new Map(allBooks.map(b => [b.name, b.id]));

  // Track chapters we've already inserted (avoid duplicates across pages)
  const inserted = new Set<string>();
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const spec of PAGES) {
    const bookId = nameToId.get(spec.correctBook);
    if (!bookId) {
      console.log(`❌ Book not found: ${spec.correctBook}`);
      continue;
    }

    console.log(`\n📄 Page ${spec.page} → ${spec.correctBook}`);

    // Extract from PDF page
    let extraction;
    try {
      extraction = await extractPage(spec.page);
      console.log(`   Extracted ${extraction.chapters.length} chapters, ${extraction.chapters.reduce((s, c) => s + c.verses.length, 0)} verses`);
    } catch (err: any) {
      console.log(`   ❌ Extraction failed: ${err.message}`);
      if (err.message?.includes('429') || err.message?.includes('rate')) {
        console.log('   ⏳ Rate limited, waiting 60s...');
        await sleep(60000);
      }
      continue;
    }

    // Process only the chapters we need
    for (const ch of extraction.chapters) {
      const chNum = ch.chapter;
      const key = `${spec.correctBook}:${chNum}`;

      // Skip chapters not in our expected list
      if (!spec.expectedChapters.includes(chNum)) continue;
      // Skip if already inserted
      if (inserted.has(key)) continue;

      // Check if target already exists in DB
      const existing = await db.query.chapterContents.findFirst({
        where: (c, { and: a, eq: e }) => a(e(c.bookId, bookId), e(c.chapterNumber, chNum))
      });
      if (existing) {
        console.log(`   ⏭️  ${spec.correctBook} Ch.${chNum}: already exists (${(existing.content as any)?.sections?.[0]?.verses?.length || 0}v)`);
        totalSkipped++;
        inserted.add(key);
        continue;
      }

      // Load structure
      const struct = loadStructureForChapter(spec.correctBook, chNum);
      const { content, formattingRules, style } = buildDBContent(ch.verses, struct);

      const subCount = formattingRules.subtitles.length;
      const breakCount = formattingRules.paragraphBreaks.length;
      console.log(`   ✅ ${spec.correctBook} Ch.${chNum}: ${ch.verses.length}v, ${subCount} subtitles, ${breakCount} paragraph breaks`);

      if (live) {
        await db.insert(chapterContents).values({
          bookId,
          chapterNumber: chNum,
          content: content as any,
          style,
          formattingRules: formattingRules as any,
          verified: 0,
        });
      }
      inserted.add(key);
      totalInserted++;
    }

    // Rate limit: wait between pages
    await sleep(3000);
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Inserted: ${totalInserted}`);
  console.log(`Skipped: ${totalSkipped}`);
  if (!live) console.log('\n✅ DRY RUN. Re-run with --live to apply.');
}

main().catch(err => { console.error('❌', err); process.exit(1); });
