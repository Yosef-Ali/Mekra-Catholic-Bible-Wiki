/**
 * Fix misassigned chapters: the page_map had wrong boundaries, causing
 * chapters to be inserted under the wrong book_id.
 *
 * This script:
 *   1. Copies content from wrong-book rows to the correct book
 *   2. Applies structure (subtitles, paragraph_breaks) from structure files
 *   3. Reports chapters that need re-extraction (no source data exists)
 *
 * Usage:
 *   pnpm tsx scripts/fix-misassigned-chapters.ts              # dry run
 *   pnpm tsx scripts/fix-misassigned-chapters.ts --live       # apply
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { db, sql } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and } from 'drizzle-orm';

const STRUCT_DIR = path.join(process.cwd(), 'extraction_output');
const PAGE_MAP_PATH = path.join(STRUCT_DIR, 'page_map.json');

// ── Misassignment map ──────────────────────────────────────────────
// source book (where it was wrongly stored) → target book (correct) + chapters
const MOVES: Array<{
  source: string;
  target: string;
  chapters: number[];
}> = [
  { source: 'Malachi',        target: 'Matthew',        chapters: [1, 2, 3, 4] },
  { source: 'Wisdom',         target: 'Sirach',         chapters: [12, 13, 14, 15, 16, 17, 18] },
  { source: 'Isaiah',         target: 'Sirach',         chapters: [8, 9, 10, 11, 12, 13, 14, 15, 16] },
  { source: 'Habakkuk',       target: 'Zephaniah',      chapters: [2, 3] },
  { source: '1 Corinthians',  target: '2 Corinthians',  chapters: [1, 2, 3, 4, 5, 6] },
  { source: '2 Corinthians',  target: '1 Corinthians',  chapters: [8, 9] },
  { source: '1 Maccabees',    target: '2 Maccabees',    chapters: [16] },
  { source: 'Job',            target: '2 Maccabees',    chapters: [7, 8] },
];

// ── Structure helpers ──────────────────────────────────────────────
interface Subtitle { text: string; before_verse: number }
interface ChStruct {
  chapter: number;
  subtitles: Subtitle[];
  paragraph_breaks: number[];
  poetry_ranges: Array<[number, number]>;
}

interface BookEntry { name: string; start_page: number; end_page: number }

function loadStructureForBook(
  bookName: string,
  pageMap: BookEntry[]
): Map<number, ChStruct> {
  const result = new Map<number, ChStruct>();
  const entry = pageMap.find(b =>
    b.name === bookName ||
    b.name === bookName.replace(/ /g, '_')
  );
  if (!entry) return result;

  // Also check adjacent pages (±5) since page_map boundaries are off
  const startPage = Math.max(1, entry.start_page - 5);
  const endPage = entry.end_page + 5;

  for (let p = startPage; p <= endPage; p++) {
    const file = path.join(STRUCT_DIR, `structure_page_${p}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      for (const ch of data.chapters || []) {
        if (ch.chapter > 0 && !result.has(ch.chapter)) {
          result.set(ch.chapter, ch);
        } else if (result.has(ch.chapter)) {
          // Merge: add any new subtitles/breaks
          const existing = result.get(ch.chapter)!;
          const existingBreaks = new Set(existing.paragraph_breaks);
          for (const b of ch.paragraph_breaks || []) existingBreaks.add(b);
          existing.paragraph_breaks = Array.from(existingBreaks).sort((a, b) => a - b);
          const existingSubs = new Map(existing.subtitles.map((s: Subtitle) => [s.before_verse, s.text]));
          for (const s of ch.subtitles || []) {
            if (s?.text && !existingSubs.has(s.before_verse)) {
              existing.subtitles.push(s);
              existingSubs.set(s.before_verse, s.text);
            }
          }
        }
      }
    } catch { /* skip bad files */ }
  }
  return result;
}

function applyStructure(
  content: any,
  struct: ChStruct | undefined
): { content: any; formattingRules: any; style: string } {
  const sections = content?.sections || [];
  const allVerses = sections.flatMap((s: any) => s.verses || []);

  if (struct && allVerses.length > 0) {
    const breakSet = new Set(struct.paragraph_breaks || []);

    // Apply paragraph breaks to verses
    for (const v of allVerses) {
      v.is_new_paragraph = v.verse_number === 1 || breakSet.has(v.verse_number - 1);
    }

    // Build formatting rules
    const subtitles = (struct.subtitles || [])
      .filter((s: Subtitle) => s?.text)
      .sort((a: Subtitle, b: Subtitle) => a.before_verse - b.before_verse)
      .map((s: Subtitle) => ({ verse: s.before_verse, text: s.text }));

    const paragraphBreaks = struct.paragraph_breaks?.sort((a: number, b: number) => a - b) || [];
    const hasPoetry = (struct.poetry_ranges?.length || 0) > 0;
    const poetrySections = (struct.poetry_ranges || []).map(([s, e]: [number, number]) => ({
      verseRange: [s, e], type: 'poetry', indent: 1,
    }));

    const formattingRules = { subtitles, paragraphBreaks, hasPoetry, sections: poetrySections };
    const style = hasPoetry ? 'mixed' : 'rich';

    return {
      content: { sections: [{ ...sections[0], verses: allVerses }] },
      formattingRules,
      style,
    };
  }

  // No structure — just return as-is
  return {
    content,
    formattingRules: { sections: [], hasPoetry: false, subtitles: [], paragraphBreaks: [] },
    style: 'prose',
  };
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  const live = process.argv.includes('--live');
  console.log(`Mode: ${live ? '🚨 LIVE' : 'DRY RUN'}\n`);

  const allBooks = await db.select().from(books);
  const nameToId = new Map(allBooks.map(b => [b.name, b.id]));
  const idToName = new Map(allBooks.map(b => [b.id, b.name]));

  const pageMap: BookEntry[] = JSON.parse(fs.readFileSync(PAGE_MAP_PATH, 'utf-8')).books;

  let moved = 0, skipped = 0, needExtraction: string[] = [];

  // Deduplicate Sirach targets (chapters 12-16 appear in both Wisdom and Isaiah moves)
  // Isaiah source takes priority since it has more chapters
  const seenTargets = new Set<string>();

  for (const move of MOVES) {
    const srcId = nameToId.get(move.source);
    const tgtId = nameToId.get(move.target);
    if (!srcId || !tgtId) {
      console.log(`❌ Book not found: ${move.source} or ${move.target}`);
      continue;
    }

    // Load structure for the TARGET book
    const structMap = loadStructureForBook(move.target, pageMap);

    for (const ch of move.chapters) {
      const tgtKey = `${move.target}:${ch}`;
      if (seenTargets.has(tgtKey)) continue;
      seenTargets.add(tgtKey);

      // Check if target already has data
      const tgtRow = await db.query.chapterContents.findFirst({
        where: (c, { and: a, eq: e }) => a(e(c.bookId, tgtId), e(c.chapterNumber, ch))
      });
      if (tgtRow) {
        console.log(`⏭️  ${move.target} Ch.${ch}: target already has data, skipping`);
        skipped++;
        continue;
      }

      // Get source row
      const srcRow = await db.query.chapterContents.findFirst({
        where: (c, { and: a, eq: e }) => a(e(c.bookId, srcId), e(c.chapterNumber, ch))
      });

      if (!srcRow) {
        console.log(`⚠️  ${move.source} Ch.${ch} → ${move.target}: source missing, needs re-extraction`);
        needExtraction.push(`${move.target} Ch.${ch}`);
        continue;
      }

      const struct = structMap.get(ch);
      const { content, formattingRules, style } = applyStructure(srcRow.content, struct);
      const verseCount = content?.sections?.[0]?.verses?.length || 0;
      const subCount = formattingRules?.subtitles?.length || 0;
      const breakCount = formattingRules?.paragraphBreaks?.length || 0;

      console.log(
        `✅ ${move.source} Ch.${ch} → ${move.target} Ch.${ch}: ` +
        `${verseCount}v, ${subCount} subtitles, ${breakCount} paragraph breaks`
      );

      if (live) {
        await db.insert(chapterContents).values({
          bookId: tgtId,
          chapterNumber: ch,
          content: content as any,
          style,
          formattingRules: formattingRules as any,
          verified: 0,
        });
      }
      moved++;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Moved: ${moved}`);
  console.log(`Skipped (already exists): ${skipped}`);
  if (needExtraction.length) {
    console.log(`\n⚠️  Need re-extraction (${needExtraction.length}):`);
    for (const n of needExtraction) console.log(`   - ${n}`);
  }

  if (!live) {
    console.log('\n✅ DRY RUN. Re-run with --live to apply.');
  }
}

main().catch(err => { console.error('❌', err); process.exit(1); });
