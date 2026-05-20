/**
 * Reseed formatted_chapter_contents from raw vision_page_*.json files.
 *
 * Strategy:
 *  1. Walk all extraction_output/vision_page_<N>.json files.
 *  2. Resolve each page's book via page_map.json (start/end ranges).
 *  3. Group verses by (book, chapter) across pages — chapters span pages.
 *  4. Within each chapter, merge verses by verse_number (later page wins on conflict).
 *  5. TRUNCATE formatted_chapter_contents (backup already taken).
 *  6. Bulk insert one row per (book, chapter) with clean JSONB content.
 *
 * Usage:
 *   pnpm tsx scripts/reseed-from-raw.ts --dry-run   # plan only
 *   pnpm tsx scripts/reseed-from-raw.ts --live      # actually truncate + insert
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { sql } from '../services/db';
import { stripLeadingVerseNumber } from './lib/geez-numerals';

const RAW_DIR = path.join(process.cwd(), 'extraction_output');
const PAGE_MAP_PATH = path.join(RAW_DIR, 'page_map.json');

interface BookEntry {
  name: string;
  amharic: string;
  start_page: number;
  end_page: number;
  expected_chapters: number;
}

interface RawVerse { verse_number: number; text: string }
interface RawChapter { book: string; chapter: number; verses: RawVerse[] }
interface RawPage { pages: number[]; chapters: RawChapter[] }

function loadPageMap(): BookEntry[] {
  return JSON.parse(fs.readFileSync(PAGE_MAP_PATH, 'utf-8')).books;
}

function resolveBookForPage(pageNum: number, books: BookEntry[]): BookEntry | null {
  for (const b of books) {
    if (pageNum >= b.start_page && pageNum <= b.end_page) return b;
  }
  return null;
}

function toDBContent(verses: RawVerse[]) {
  return {
    sections: [{
      type: 'prose',
      subtitle_level: 'single',
      subtitle_text: '',
      verses: verses.map(v => ({
        verse_number: v.verse_number,
        text: v.text,
        is_new_paragraph: v.verse_number === 1,
        indent: 0,
      })),
    }],
  };
}

async function main() {
  const live = process.argv.includes('--live');
  const dryRun = !live;

  console.log(`Mode: ${dryRun ? 'DRY RUN' : '🚨 LIVE — will TRUNCATE and re-insert'}\n`);

  const pageMap = loadPageMap();

  // Step 1: walk raw files
  const files = fs.readdirSync(RAW_DIR).filter(f => /^vision_page_\d+\.json$/.test(f));
  console.log(`Raw files: ${files.length}`);

  // Step 2 + 3: aggregate by (bookName, chapter)
  // Key: `${bookName}\u0000${chapterNum}` — bookName from page_map (canonical English).
  const aggregated = new Map<string, { book: BookEntry; chapter: number; verses: Map<number, string> }>();
  let unresolvedPages = 0;
  let glossaryPagesSkipped = 0;

  for (const f of files) {
    const m = f.match(/vision_page_(\d+)\.json/);
    if (!m) continue;
    const pageNum = parseInt(m[1], 10);
    const book = resolveBookForPage(pageNum, pageMap);
    if (!book) { unresolvedPages++; continue; }

    const data: RawPage = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), 'utf-8'));
    const chapters = data.chapters || [];

    // Glossary/index detector: pages with many tiny "chapters" from many distinct
    // books are scripture cross-reference indexes (back-of-book material).
    // Heuristic: ≥4 distinct raw book names AND avg verses per chapter < 2.
    const distinctBooks = new Set(chapters.map(c => c.book)).size;
    const totalVerses = chapters.reduce((s, c) => s + (c.verses?.length ?? 0), 0);
    const avgVersesPerChapter = chapters.length ? totalVerses / chapters.length : 0;
    if (distinctBooks >= 4 && avgVersesPerChapter < 2) {
      glossaryPagesSkipped++;
      continue;
    }

    for (const ch of chapters) {
      // Skip chapter numbers that exceed the book's known chapter count — these
      // are leftover index/glossary entries that escaped the page-level filter.
      if (ch.chapter < 1 || ch.chapter > book.expected_chapters) continue;

      const key = `${book.name}\u0000${ch.chapter}`;
      let entry = aggregated.get(key);
      if (!entry) {
        entry = { book, chapter: ch.chapter, verses: new Map() };
        aggregated.set(key, entry);
      }
      for (const v of ch.verses || []) {
        // Strip leading verse-number leak (Ge'ez or Arabic).
        const cleaned = stripLeadingVerseNumber(v.text, v.verse_number);
        entry.verses.set(v.verse_number, cleaned);
      }
    }
  }
  console.log(`Glossary/index pages skipped: ${glossaryPagesSkipped}`);

  console.log(`Unresolved pages (no book in page_map): ${unresolvedPages}`);
  console.log(`Aggregated chapters: ${aggregated.size}`);

  // Resolve book IDs from DB
  const dbBooks = await sql`SELECT id, name FROM books`;
  const bookIdByName = new Map<string, number>();
  for (const b of dbBooks as Array<{ id: number; name: string }>) {
    bookIdByName.set(b.name, b.id);
    bookIdByName.set(b.name.replace(/ /g, '_'), b.id);
  }

  // Build insert rows
  type Row = { book_id: number; chapter_number: number; content: any; book_name: string };
  const rows: Row[] = [];
  const missingBooks = new Set<string>();

  for (const entry of aggregated.values()) {
    const bookId = bookIdByName.get(entry.book.name);
    if (!bookId) { missingBooks.add(entry.book.name); continue; }
    const verses = Array.from(entry.verses.entries())
      .sort(([a], [b]) => a - b)
      .map(([verse_number, text]) => ({ verse_number, text }));
    rows.push({
      book_id: bookId,
      chapter_number: entry.chapter,
      content: toDBContent(verses),
      book_name: entry.book.name,
    });
  }

  if (missingBooks.size > 0) {
    console.log(`⚠️  Books in page_map but not in DB: ${[...missingBooks].join(', ')}`);
  }

  // Stats
  const byBook = new Map<string, number>();
  for (const r of rows) byBook.set(r.book_name, (byBook.get(r.book_name) ?? 0) + 1);
  console.log(`\nWill insert ${rows.length} chapters across ${byBook.size} books`);

  // Sanity: print a few samples
  const sample = rows.find(r => r.book_name === 'Genesis' && r.chapter_number === 1);
  if (sample) {
    const v1 = sample.content.sections[0].verses[0];
    console.log(`\nSample — Genesis 1 v1: "${v1.text.slice(0, 80)}..."`);
  }

  if (dryRun) {
    console.log('\n✅ DRY RUN complete. Re-run with --live to apply.');
    return;
  }

  // LIVE
  console.log('\n🚨 TRUNCATING formatted_chapter_contents...');
  await sql`TRUNCATE TABLE formatted_chapter_contents RESTART IDENTITY`;
  console.log('✅ Truncated. Inserting...');

  const bookIds = rows.map(r => r.book_id);
  const chapterNums = rows.map(r => r.chapter_number);
  const contents = rows.map(r => JSON.stringify(r.content));
  await sql`
    INSERT INTO formatted_chapter_contents (book_id, chapter_number, content, style, verified)
    SELECT * FROM UNNEST(
      ${bookIds}::int[],
      ${chapterNums}::int[],
      ${contents}::jsonb[],
      ARRAY(SELECT 'prose' FROM generate_series(1, ${rows.length}))::text[],
      ARRAY(SELECT 0 FROM generate_series(1, ${rows.length}))::int[]
    )
  `;
  console.log(`\n✅ Inserted ${rows.length} chapters.`);
}

main().catch(err => { console.error('❌ Re-seed failed:', err); process.exit(1); });
