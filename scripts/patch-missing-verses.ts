/**
 * Patch missing verses by re-extracting ONLY the specific PDF pages
 * where gaps were found, then merging into the database.
 *
 * Strategy:
 *   1. Parse the missing verses report into a structured list.
 *   2. For each (book, chapter), find the PDF page(s) from page_map.
 *   3. Extract text from those pages using PyMuPDF.
 *   4. Send to Gemini asking specifically for the missing verse numbers.
 *   5. Merge into existing DB rows (insert missing verses, keep existing).
 *
 * Usage:
 *   npx tsx scripts/patch-missing-verses.ts --dry-run   # plan only
 *   npx tsx scripts/patch-missing-verses.ts --live       # patch DB
 *   npx tsx scripts/patch-missing-verses.ts --live --book Genesis  # single book
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import {
  type ExtractedVerse,
  buildSystemPrompt, cleanJsonResponse, requireEnv, sleep,
  MAP_PATH,
} from './bible-shared';

const DATABASE_URL = requireEnv('DATABASE_URL');
const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');
const sql = neon(DATABASE_URL);

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--live');
const BOOK_FILTER = args.find(a => a !== '--live' && a !== '--dry-run') || '';

// ─── Missing verses from the report ─────────────────────────────────────────

interface MissingEntry {
  book: string;        // page_map name (e.g. "Genesis", "1_Samuel")
  dbName: string;      // DB name (e.g. "Genesis", "1 Samuel")
  chapter: number;
  missingVerses: number[];
}

const MISSING: MissingEntry[] = [
  // Old Testament
  { book: 'Genesis', dbName: 'Genesis', chapter: 11, missingVerses: [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19] },
  { book: 'Genesis', dbName: 'Genesis', chapter: 37, missingVerses: [19,20] },
  { book: 'Exodus', dbName: 'Exodus', chapter: 7, missingVerses: [13] },
  { book: 'Exodus', dbName: 'Exodus', chapter: 13, missingVerses: [16] },
  { book: 'Numbers', dbName: 'Numbers', chapter: 9, missingVerses: [7] },
  { book: 'Deuteronomy', dbName: 'Deuteronomy', chapter: 25, missingVerses: [9,10] },
  { book: 'Deuteronomy', dbName: 'Deuteronomy', chapter: 31, missingVerses: [5] },
  { book: 'Joshua', dbName: 'Joshua', chapter: 13, missingVerses: [9,10,11] },
  { book: 'Judges', dbName: 'Judges', chapter: 14, missingVerses: [3,4] },
  { book: 'Judges', dbName: 'Judges', chapter: 16, missingVerses: [6] },
  { book: '1_Samuel', dbName: '1 Samuel', chapter: 11, missingVerses: [7,8,9,10,11] },
  { book: '2_Samuel', dbName: '2 Samuel', chapter: 15, missingVerses: [28,29] },
  { book: '1_Kings', dbName: '1 Kings', chapter: 13, missingVerses: [5,6] },
  { book: '2_Kings', dbName: '2 Kings', chapter: 13, missingVerses: [5] },
  { book: '2_Chronicles', dbName: '2 Chronicles', chapter: 12, missingVerses: [7,8] },
  { book: '2_Chronicles', dbName: '2 Chronicles', chapter: 35, missingVerses: [5,6] },
  { book: 'Ezra', dbName: 'Ezra', chapter: 2, missingVerses: [2] },
  { book: 'Ezra', dbName: 'Ezra', chapter: 4, missingVerses: [5] },
  { book: 'Jeremiah', dbName: 'Jeremiah', chapter: 5, missingVerses: [29] },
  { book: 'Lamentations', dbName: 'Lamentations', chapter: 3, missingVerses: [49,50] },
  { book: 'Ezekiel', dbName: 'Ezekiel', chapter: 14, missingVerses: [17] },
  { book: 'Ezekiel', dbName: 'Ezekiel', chapter: 26, missingVerses: [8,9] },
  { book: 'Daniel', dbName: 'Daniel', chapter: 2, missingVerses: [6,7] },
  // Deuterocanonical
  { book: 'Tobit', dbName: 'Tobit', chapter: 8, missingVerses: [6] },
  { book: 'Esther', dbName: 'Esther', chapter: 2, missingVerses: [1,2,3,4,5,6] },
  { book: '1_Maccabees', dbName: '1 Maccabees', chapter: 14, missingVerses: [6] },
  { book: '2_Maccabees', dbName: '2 Maccabees', chapter: 9, missingVerses: [1,2,3,4,5,6,7,8,9] },
  { book: '2_Maccabees', dbName: '2 Maccabees', chapter: 12, missingVerses: [17] },
  { book: '2_Maccabees', dbName: '2 Maccabees', chapter: 15, missingVerses: [7] },
  { book: 'Sirach', dbName: 'Sirach', chapter: 2, missingVerses: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21] },
  { book: 'Sirach', dbName: 'Sirach', chapter: 19, missingVerses: [18,19,21] },
  { book: 'Sirach', dbName: 'Sirach', chapter: 22, missingVerses: [3,7,8] },
  { book: 'Sirach', dbName: 'Sirach', chapter: 23, missingVerses: [1,2,3,4,5,6] },
  { book: 'Sirach', dbName: 'Sirach', chapter: 40, missingVerses: [6] },
  // Wisdom Literature
  { book: 'Job', dbName: 'Job', chapter: 11, missingVerses: [13,14] },
  { book: 'Job', dbName: 'Job', chapter: 31, missingVerses: [5,6] },
  { book: 'Job', dbName: 'Job', chapter: 34, missingVerses: [7,8,9,27,28] },
  { book: 'Job', dbName: 'Job', chapter: 35, missingVerses: [10,11] },
  { book: 'Job', dbName: 'Job', chapter: 37, missingVerses: [12,13] },
  { book: 'Job', dbName: 'Job', chapter: 38, missingVerses: [6,7,19,20,25,26,29,30,37,38,39,40] },
  { book: 'Psalms', dbName: 'Psalms', chapter: 57, missingVerses: [1,2,3,4,5,6] },
  { book: 'Psalms', dbName: 'Psalms', chapter: 66, missingVerses: [13,14] },
  { book: 'Psalms', dbName: 'Psalms', chapter: 94, missingVerses: [12,13] },
  { book: 'Psalms', dbName: 'Psalms', chapter: 105, missingVerses: [5,6,14,15] },
  { book: 'Psalms', dbName: 'Psalms', chapter: 106, missingVerses: [21,22,26,27,32,33] },
  { book: 'Psalms', dbName: 'Psalms', chapter: 113, missingVerses: [7,8] },
  { book: 'Psalms', dbName: 'Psalms', chapter: 144, missingVerses: [7,8] },
  { book: 'Proverbs', dbName: 'Proverbs', chapter: 22, missingVerses: [20,21] },
  // New Testament
  { book: 'Matthew', dbName: 'Matthew', chapter: 9, missingVerses: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26] },
  { book: 'Matthew', dbName: 'Matthew', chapter: 18, missingVerses: [11] },
  { book: 'Luke', dbName: 'Luke', chapter: 18, missingVerses: [19,20] },
  { book: 'Luke', dbName: 'Luke', chapter: 20, missingVerses: [30,31] },
  { book: 'Luke', dbName: 'Luke', chapter: 21, missingVerses: [22,23,24] },
  { book: 'John', dbName: 'John', chapter: 14, missingVerses: [4] },
  { book: 'John', dbName: 'John', chapter: 18, missingVerses: [27] },
  { book: 'Acts', dbName: 'Acts', chapter: 3, missingVerses: [19,20] },
  { book: 'Acts', dbName: 'Acts', chapter: 4, missingVerses: [5,6,27,28,29,30] },
  { book: 'Acts', dbName: 'Acts', chapter: 5, missingVerses: [22,23] },
  { book: 'Acts', dbName: 'Acts', chapter: 7, missingVerses: [17,18,31,48,49,50] },
  { book: 'Acts', dbName: 'Acts', chapter: 10, missingVerses: [34,35] },
  { book: 'Acts', dbName: 'Acts', chapter: 14, missingVerses: [21,22] },
  { book: 'Acts', dbName: 'Acts', chapter: 15, missingVerses: [25,26,28,29] },
  { book: 'Acts', dbName: 'Acts', chapter: 17, missingVerses: [19,20,26,27] },
  { book: 'Acts', dbName: 'Acts', chapter: 18, missingVerses: [9,10] },
  { book: 'Acts', dbName: 'Acts', chapter: 20, missingVerses: [18,19] },
  { book: 'Acts', dbName: 'Acts', chapter: 21, missingVerses: [27,28] },
  { book: 'Acts', dbName: 'Acts', chapter: 24, missingVerses: [20,21] },
  { book: 'Acts', dbName: 'Acts', chapter: 26, missingVerses: [2,3,17,18,22,23] },
  { book: '1_Corinthians', dbName: '1 Corinthians', chapter: 14, missingVerses: [28] },
  { book: '2_Corinthians', dbName: '2 Corinthians', chapter: 7, missingVerses: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] },
  { book: 'Revelation', dbName: 'Revelation', chapter: 4, missingVerses: [9,10] },
  { book: 'Revelation', dbName: 'Revelation', chapter: 5, missingVerses: [9,10] },
];

// ─── Page map ───────────────────────────────────────────────────────────────

interface BookEntry { name: string; amharic: string; start_page: number; end_page: number; expected_chapters: number }

function loadPageMap(): BookEntry[] {
  return JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8')).books;
}

// Estimate which PDF page a chapter falls on (rough: proportional within book's page range)
function estimatePages(book: BookEntry, chapter: number): { start: number; end: number } {
  const totalPages = book.end_page - book.start_page + 1;
  const chaptersPerPage = book.expected_chapters / totalPages;
  const estPage = book.start_page + Math.floor((chapter - 1) / chaptersPerPage);
  // Take page and neighbors to be safe
  return {
    start: Math.max(book.start_page, estPage - 1),
    end: Math.min(book.end_page, estPage + 1),
  };
}

// ─── PyMuPDF text extraction ────────────────────────────────────────────────

function extractLayoutText(startPage: number, endPage: number, bookName: string): string {
  const cmd = `python3 scripts/extract-layout.py ${startPage} ${endPage} "${bookName}"`;
  const output = execSync(cmd, {
    cwd: process.cwd(),
    maxBuffer: 50 * 1024 * 1024,
    timeout: 60000,
  });
  const result = JSON.parse(output.toString());
  return result.full_enriched as string;
}

// ─── Gemini call for targeted verse extraction ──────────────────────────────

function extractMissingVerses(
  enrichedText: string,
  bookName: string,
  chapter: number,
  missingVerses: number[],
): ExtractedVerse[] {
  const prompt = `${buildSystemPrompt()}

TASK: From the following Amharic Bible text for ${bookName}, extract ONLY chapter ${chapter}, verses ${missingVerses.join(', ')}.

These specific verses were missed in a prior extraction. They MUST exist on these pages.
Search carefully — verse numbers may appear as superscripts, inline numbers, or Geez numerals.

Return JSON:
{
  "verses": [
    { "verse_number": N, "text": "exact Amharic text", "is_new_paragraph": false, "indent": 0 }
  ]
}

If a verse truly does not appear on these pages, omit it. Do NOT fabricate text.

TEXT:
${enrichedText}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const output = execSync(
        `python3 -c "
import sys, json, os
from google import genai
client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])
resp = client.models.generate_content(
    model='gemini-2.5-flash-preview-05-20',
    contents=sys.stdin.read(),
    config={'response_mime_type': 'application/json', 'temperature': 0.1}
)
print(resp.text)
"`,
        {
          input: prompt,
          env: { ...process.env, GEMINI_API_KEY },
          cwd: process.cwd(),
          maxBuffer: 10 * 1024 * 1024,
          timeout: 120_000,
        },
      );
      const parsed = JSON.parse(cleanJsonResponse(output.toString()));
      return (parsed.verses || []) as ExtractedVerse[];
    } catch (err: any) {
      console.error(`     ⚠️  Attempt ${attempt}/3: ${(err.message || '').substring(0, 100)}`);
      if (attempt < 3) execSync(`sleep ${attempt * 20}`);
    }
  }
  return [];
}

// ─── Merge into DB ──────────────────────────────────────────────────────────

async function mergeVerses(dbName: string, chapter: number, newVerses: ExtractedVerse[]): Promise<number> {
  if (newVerses.length === 0) return 0;

  // Get existing row
  const rows = await sql`
    SELECT fcc.id, fcc.content
    FROM formatted_chapter_contents fcc
    JOIN books b ON fcc.book_id = b.id
    WHERE b.name = ${dbName} AND fcc.chapter_number = ${chapter}
  `;

  if (rows.length === 0) {
    console.error(`     ❌ No DB row for ${dbName} ch${chapter}`);
    return 0;
  }

  const row = rows[0];
  const content = row.content as any;
  const sections = content.sections || [];

  // Collect existing verse numbers
  const existingNums = new Set<number>();
  for (const sec of sections) {
    for (const v of sec.verses || []) {
      existingNums.add(v.verse_number);
    }
  }

  // Filter to truly missing verses
  const toInsert = newVerses.filter(v => !existingNums.has(v.verse_number));
  if (toInsert.length === 0) return 0;

  // Insert into the appropriate section (find where verse fits by number)
  for (const nv of toInsert) {
    let inserted = false;
    for (const sec of sections) {
      const verses = sec.verses || [];
      if (verses.length === 0) continue;
      const first = verses[0].verse_number;
      const last = verses[verses.length - 1].verse_number;
      // Insert if verse fits in this section's range (or extends it by 1-2)
      if (nv.verse_number >= first - 2 && nv.verse_number <= last + 2) {
        verses.push(nv);
        verses.sort((a: any, b: any) => a.verse_number - b.verse_number);
        inserted = true;
        break;
      }
    }
    // If no section matched, add to the first section
    if (!inserted && sections.length > 0) {
      sections[0].verses.push(nv);
      sections[0].verses.sort((a: any, b: any) => a.verse_number - b.verse_number);
    }
  }

  // Update DB
  if (!DRY_RUN) {
    await sql`
      UPDATE formatted_chapter_contents
      SET content = ${JSON.stringify(content)}::jsonb,
          updated_at = NOW()
      WHERE id = ${row.id}
    `;
  }

  return toInsert.length;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔧 Patch Missing Verses — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`   Total entries: ${MISSING.length} (${MISSING.reduce((s, m) => s + m.missingVerses.length, 0)} verses)\n`);

  const books = loadPageMap();
  const bookMap = new Map(books.map(b => [b.name, b]));

  let totalPatched = 0;
  let totalFailed = 0;

  // Group by book to batch page extractions
  const byBook = new Map<string, MissingEntry[]>();
  for (const m of MISSING) {
    if (BOOK_FILTER && m.book !== BOOK_FILTER && m.dbName !== BOOK_FILTER) continue;
    const list = byBook.get(m.book) || [];
    list.push(m);
    byBook.set(m.book, list);
  }

  for (const [bookName, entries] of byBook) {
    const book = bookMap.get(bookName);
    if (!book) {
      console.error(`❌ Book "${bookName}" not in page_map.json`);
      totalFailed += entries.reduce((s, e) => s + e.missingVerses.length, 0);
      continue;
    }

    console.log(`📖 ${bookName} (${book.amharic}) — ${entries.length} chapter(s)`);

    for (const entry of entries) {
      const { start, end } = estimatePages(book, entry.chapter);
      console.log(`   Ch ${entry.chapter}: missing ${entry.missingVerses.join(',')} → pages ${start}-${end}`);

      try {
        // Extract text from PDF pages
        const text = extractLayoutText(start, end, bookName);
        console.log(`     → ${Math.round(text.length / 1024)}KB text extracted`);

        // Ask Gemini for just the missing verses
        const verses = extractMissingVerses(text, bookName, entry.chapter, entry.missingVerses);
        console.log(`     → Gemini returned ${verses.length} verse(s): ${verses.map(v => v.verse_number).join(',')}`);

        if (verses.length > 0) {
          const patched = await mergeVerses(entry.dbName, entry.chapter, verses);
          console.log(`     → ${DRY_RUN ? 'Would patch' : 'Patched'} ${patched} verse(s)`);
          totalPatched += patched;
        } else {
          console.log(`     ⚠️  No verses found — may need manual review`);
          totalFailed += entry.missingVerses.length;
        }

        await sleep(8000); // Rate limit
      } catch (err: any) {
        console.error(`     ❌ ${err.message.substring(0, 100)}`);
        totalFailed += entry.missingVerses.length;
      }
    }
  }

  console.log(`\n✅ Done: ${totalPatched} patched, ${totalFailed} failed`);
  if (DRY_RUN) console.log('   (dry run — use --live to actually patch)');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
