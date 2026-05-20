/**
 * Merge structure_page_*.json into formatted_chapter_contents.formatting_rules.
 *
 *   pnpm tsx scripts/merge-structure.ts            # dry run
 *   pnpm tsx scripts/merge-structure.ts --live     # apply
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { sql } from '../services/db';

const RAW_DIR = path.join(process.cwd(), 'extraction_output');
const PAGE_MAP_PATH = path.join(RAW_DIR, 'page_map.json');

interface BookEntry { name: string; start_page: number; end_page: number; expected_chapters: number }
interface Subtitle { text: string; before_verse: number }
interface ChStruct { chapter: number; subtitles: Subtitle[]; paragraph_breaks: number[]; poetry_ranges: Array<[number, number]> }
interface PageStruct { page: number; chapters: ChStruct[] }

function resolveBook(pageNum: number, books: BookEntry[]): BookEntry | null {
  for (const b of books) if (pageNum >= b.start_page && pageNum <= b.end_page) return b;
  return null;
}

interface Agg {
  bookName: string;
  chapter: number;
  subtitles: Map<number, string>; // verse -> text (last write wins)
  paragraphBreaks: Set<number>;
  poetryRanges: Array<[number, number]>;
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur[0] <= last[1] + 1) last[1] = Math.max(last[1], cur[1]);
    else out.push(cur);
  }
  return out;
}

async function main() {
  const live = process.argv.includes('--live');
  console.log(`Mode: ${live ? '🚨 LIVE' : 'DRY RUN'}\n`);

  const books: BookEntry[] = JSON.parse(fs.readFileSync(PAGE_MAP_PATH, 'utf-8')).books;
  const files = fs.readdirSync(RAW_DIR).filter(f => /^structure_page_\d+\.json$/.test(f));
  console.log(`Structure files: ${files.length}`);

  const agg = new Map<string, Agg>();
  let unresolved = 0;

  for (const f of files) {
    const pageNum = parseInt(f.match(/structure_page_(\d+)/)![1], 10);
    const book = resolveBook(pageNum, books);
    if (!book) { unresolved++; continue; }

    const data: PageStruct = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), 'utf-8'));
    for (const ch of data.chapters || []) {
      if (ch.chapter < 1 || ch.chapter > book.expected_chapters) continue;
      const key = `${book.name}\u0000${ch.chapter}`;
      let entry = agg.get(key);
      if (!entry) {
        entry = { bookName: book.name, chapter: ch.chapter, subtitles: new Map(), paragraphBreaks: new Set(), poetryRanges: [] };
        agg.set(key, entry);
      }
      for (const s of ch.subtitles || []) {
        if (s?.text && Number.isFinite(s.before_verse)) entry.subtitles.set(s.before_verse, s.text);
      }
      for (const p of ch.paragraph_breaks || []) entry.paragraphBreaks.add(p);
      for (const r of ch.poetry_ranges || []) if (Array.isArray(r) && r.length === 2) entry.poetryRanges.push([r[0], r[1]]);
    }
  }
  console.log(`Aggregated chapters: ${agg.size}`);
  if (unresolved) console.log(`Unresolved pages: ${unresolved}`);

  const dbBooks = await sql`SELECT id, name FROM books` as Array<{ id: number; name: string }>;
  const idByName = new Map<string, number>();
  for (const b of dbBooks) {
    idByName.set(b.name, b.id);
    idByName.set(b.name.replace(/ /g, '_'), b.id);
  }

  // Fetch existing chapter rows so we know max verse number per chapter (for poetry sections fallback span)
  const dbRows = await sql`
    SELECT id, book_id, chapter_number FROM formatted_chapter_contents
  ` as Array<{ id: number; book_id: number; chapter_number: number }>;
  const rowIdByKey = new Map<string, number>();
  for (const r of dbRows) rowIdByKey.set(`${r.book_id}:${r.chapter_number}`, r.id);

  type Update = { id: number; rules: any };
  const updates: Update[] = [];
  let missingRows = 0, missingBooks = 0;

  for (const e of agg.values()) {
    const bookId = idByName.get(e.bookName);
    if (!bookId) { missingBooks++; continue; }
    const rowId = rowIdByKey.get(`${bookId}:${e.chapter}`);
    if (!rowId) { missingRows++; if (process.argv.includes('--debug-missing')) console.log(`  miss: ${e.bookName} ${e.chapter}`); continue; }

    const subtitles = Array.from(e.subtitles.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([verse, text]) => ({ verse, text }));
    const paragraphBreaks = Array.from(e.paragraphBreaks).sort((a, b) => a - b);
    const poetry = mergeRanges(e.poetryRanges);
    const sections = poetry.map(([s, t]) => ({ verseRange: [s, t], type: 'poetry', indent: 1 }));

    const rules = {
      subtitles,
      paragraphBreaks,
      hasPoetry: poetry.length > 0,
      sections,
    };
    updates.push({ id: rowId, rules });
  }

  console.log(`\nUpdates: ${updates.length}`);
  if (missingBooks) console.log(`Missing book mappings: ${missingBooks}`);
  if (missingRows) console.log(`Missing chapter rows: ${missingRows}`);

  const totals = updates.reduce((acc, u) => {
    acc.sub += u.rules.subtitles.length;
    acc.brk += u.rules.paragraphBreaks.length;
    acc.poe += u.rules.sections.length;
    return acc;
  }, { sub: 0, brk: 0, poe: 0 });
  console.log(`Totals: ${totals.sub} subtitles, ${totals.brk} paragraph breaks, ${totals.poe} poetry sections`);

  const sample = updates.find(u => u.rules.subtitles.length > 0);
  if (sample) console.log(`\nSample row ${sample.id}: ${JSON.stringify(sample.rules).slice(0, 240)}...`);

  if (!live) { console.log('\n✅ DRY RUN. Re-run with --live to apply.'); return; }

  console.log('\n🚨 Applying...');
  const ids = updates.map(u => u.id);
  const rules = updates.map(u => JSON.stringify(u.rules));
  await sql`
    UPDATE formatted_chapter_contents AS fcc
    SET formatting_rules = u.fr::jsonb,
        updated_at = NOW()
    FROM UNNEST(${ids}::int[], ${rules}::text[]) AS u(id, fr)
    WHERE fcc.id = u.id
  `;
  console.log(`✅ Updated ${updates.length} rows.`);
}

main().catch(err => { console.error('❌ Failed:', err); process.exit(1); });
