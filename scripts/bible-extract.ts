/**
 * Stage 1: Extract all 73 Bible books using PyMuPDF + Gemini.
 *
 * STRATEGY:
 *   1. Python (PyMuPDF) extracts text WITH layout markers: [TITLE], [HEAD],
 *      [VERSE], [POETRY], [PARA], [PAGE N] — no file upload needed.
 *   2. Send enriched text as plain text to Gemini for structuring into
 *      chapters/verses with proper metadata.
 *   3. Text-only API calls — completely avoids the Node.js 25 fetch bug.
 *
 * Usage:
 *   npx tsx scripts/bible-extract.ts                  # all remaining books
 *   npx tsx scripts/bible-extract.ts Genesis           # single book
 *   npx tsx scripts/bible-extract.ts --force           # overwrite existing
 */

import 'dotenv/config';
import https from 'https';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import {
  type ExtractedChapter,
  cleanJsonResponse, requireEnv, sleep,
  RAW_DIR, MAP_PATH,
} from './bible-shared';

const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');
const MODEL = 'gemini-3-flash-preview';  // 1M context, large output support

if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true });

// ─── System prompt for text structuring ──────────────────────────────────────

const SYSTEM_PROMPT = `You are an Amharic Bible text structurer. You receive pre-extracted text from a scanned Bible PDF.

The text uses layout markers:
  [TITLE]  = Book title or major heading
  [HEAD]   = Chapter heading (ምዕራፍ N) or section heading
  [VERSE]  = Regular verse/prose text
  [POETRY] = Indented/poetry text or footnotes
  [PARA]   = Paragraph break signal
  [PAGE N] = Page boundary

Verse numbers appear inline in the text as arabic numbers, e.g.: "1 በመጀመሪያ..." or "[1]" or "1."

Your job: structure the text into chapters and verses as JSON.

Rules:
1. PRESERVE every Amharic character exactly — ሀ≠ሐ≠ኀ, ሰ≠ሠ, ጸ≠ፀ, አ≠ዐ
2. Identify chapter numbers from [HEAD] lines containing "ምዕራፍ N"
3. Extract verse numbers from inline numbers at start of verse text
4. Mark is_new_paragraph=true when [PARA] precedes a verse
5. Mark type="poetry" for lines from [POETRY] blocks inside chapters
6. Include subtitle_text from [HEAD] lines that are NOT chapter numbers
7. Merge split lines that belong to the same verse (same verse number, continued text)
8. SKIP footnotes, cross-references, and introductory commentary (before chapter 1)
9. Return ONLY the JSON, no markdown fences

JSON format:
{
  "chapters": [
    {
      "chapter_number": 1,
      "sections": [
        {
          "type": "prose",
          "subtitle_text": "የዓለም አፈጣጠር",
          "subtitle_level": "section",
          "verses": [
            {
              "verse_number": 1,
              "text": "በመጀመሪያ እግዚአብሔር ሰማያትንና ምድርን ፈጠረ።",
              "is_new_paragraph": true,
              "indent": 0
            }
          ]
        }
      ]
    }
  ]
}`;

// ─── Extract layout from PDF using Python/PyMuPDF ────────────────────────────

function extractLayoutText(startPage: number, endPage: number, bookName: string): string {
  const cmd = `python3 scripts/extract-layout.py ${startPage} ${endPage} "${bookName}"`;
  try {
    const output = execSync(cmd, {
      cwd: process.cwd(),
      maxBuffer: 50 * 1024 * 1024,  // 50MB
      timeout: 60000,
    });
    const result = JSON.parse(output.toString());
    return result.full_enriched as string;
  } catch (err: any) {
    throw new Error(`PyMuPDF extraction failed: ${err.message}`);
  }
}

// ─── Send enriched text to Gemini via Python requests (bypasses Node 25 bug) ──

function structureWithGemini(
  enrichedText: string,
  bookName: string,
  amharicName: string,
): ExtractedChapter[] {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // gemini-structure.py reads enriched text from stdin, calls Gemini, outputs JSON
      const output = execSync(
        `python3 scripts/gemini-structure.py "${bookName}" "${amharicName}"`,
        {
          input: enrichedText,
          env: { ...process.env, GEMINI_API_KEY },
          cwd: process.cwd(),
          maxBuffer: 20 * 1024 * 1024,
          timeout: 300_000,  // 5 min — Gemini can be slow under load
        },
      );
      const parsed = JSON.parse(output.toString());
      return (parsed.chapters || []) as ExtractedChapter[];
    } catch (err: any) {
      const msg = err.stderr?.toString()?.trim() || err.message;
      console.error(`     ⚠️  Attempt ${attempt}/3: ${msg.substring(0, 120)}`);
      if (attempt < 3) {
        // Synchronous sleep: execSync trick
        execSync(`sleep ${attempt * 30}`);  // 30s, 60s between retries
      }
    }
  }
  return [];
}

// ─── Extract a single book ──────────────────────────────────────────────────

async function extractOneBook(book: {
  name: string; amharic: string; start_page: number; end_page: number; expected_chapters: number;
}): Promise<void> {
  const outPath = path.join(RAW_DIR, `${book.name}.json`);
  const bookTotalPages = book.end_page - book.start_page + 1;

  console.log(`\n📖 ${book.name} (${book.amharic})`);
  console.log(`   PDF pages ${book.start_page}–${book.end_page} (${bookTotalPages} pages) | Expected ${book.expected_chapters} chapters`);

  // Structure with Gemini — slice into 5-page chunks to keep
  // request bodies small (Node.js 25 fetch breaks for large bodies ~>50KB).
  // Each 5-page chunk = ~30-35KB text, safely under the limit.
  const PAGES_PER_CHUNK = 3;  // 3 pages ~6 chapters, well within output limits
  const numChunks = Math.ceil(bookTotalPages / PAGES_PER_CHUNK);

  console.log(`   🤖 Structuring in ${numChunks} page-chunk(s) (${PAGES_PER_CHUNK} pages each)...`);

  let allChapters: ExtractedChapter[] = [];

  for (let chunk = 0; chunk < numChunks; chunk++) {
    const chunkStartPage = book.start_page + chunk * PAGES_PER_CHUNK;
    // Overlap by 1 page to avoid cutting mid-chapter
    const chunkEndPage = Math.min(book.end_page, chunkStartPage + PAGES_PER_CHUNK);

    console.log(`     Chunk ${chunk + 1}/${numChunks}: pages ${chunkStartPage}–${chunkEndPage}`);

    // Extract just these pages (fast, local)
    const chunkText = extractLayoutText(chunkStartPage, chunkEndPage, book.name);
    console.log(`     → ${Math.round(chunkText.length / 1024)}KB text`);

    const chapters = structureWithGemini(chunkText, book.name, book.amharic);

    if (chapters.length > 0) {
      console.log(`     → ${chapters.length} chapter(s): ${chapters.map(c => c.chapter_number).join(', ')}`);
      allChapters.push(...chapters);
    } else {
      console.error(`     ❌ No chapters in chunk ${chunk + 1}`);
    }

    if (chunk < numChunks - 1) await sleep(15000);  // 15s between chunks to avoid rate limits
  }

  // Deduplicate chapters (keep version with most verses)
  const chMap = new Map<number, ExtractedChapter>();
  for (const ch of allChapters) {
    const existing = chMap.get(ch.chapter_number);
    if (!existing) {
      chMap.set(ch.chapter_number, ch);
    } else {
      const ev = existing.sections.reduce((s, sec) => s + sec.verses.length, 0);
      const nv = ch.sections.reduce((s, sec) => s + sec.verses.length, 0);
      if (nv > ev) chMap.set(ch.chapter_number, ch);
    }
  }
  allChapters = [...chMap.values()].sort((a, b) => a.chapter_number - b.chapter_number);

  const result = {
    book_name: book.name,
    amharic_name: book.amharic,
    start_page: book.start_page,
    end_page: book.end_page,
    chapters: allChapters,
  };

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  const verseCount = result.chapters.reduce(
    (s, ch) => s + ch.sections.reduce((s2, sec) => s2 + sec.verses.length, 0), 0
  );
  const status = allChapters.length === book.expected_chapters ? '✅' : '⚠️ ';
  console.log(`   ${status} ${allChapters.length}/${book.expected_chapters} chapters, ${verseCount} verses → saved`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(MAP_PATH)) {
    console.error('❌ No page map. Run: npx tsx scripts/bible-page-map.ts');
    process.exit(1);
  }

  const pageMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8')) as {
    books: { name: string; amharic: string; start_page: number; end_page: number; expected_chapters: number }[];
  };

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const bookArgs = args.filter(a => a !== '--force');

  const targetBooks = bookArgs.length > 0
    ? pageMap.books.filter(b => bookArgs.includes(b.name))
    : pageMap.books.filter(b => b.start_page && b.end_page);

  const toProcess = force
    ? targetBooks
    : targetBooks.filter(b => {
        const outPath = path.join(RAW_DIR, `${b.name}.json`);
        if (fs.existsSync(outPath)) {
          console.log(`⏭️  Skipping ${b.name} (already extracted)`);
          return false;
        }
        return true;
      });

  if (toProcess.length === 0) {
    console.log('\n✅ All books already extracted.');
    return;
  }

  console.log(`\n🚀 Extracting ${toProcess.length} book(s)`);
  console.log(`   Method: PyMuPDF layout extraction → Gemini text structuring`);
  console.log(`   Model: ${MODEL}`);
  console.log('='.repeat(60));

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const book = toProcess[i];
    console.log(`\n[${i + 1}/${toProcess.length}]`);
    try {
      await extractOneBook(book);
      succeeded++;
    } catch (err: any) {
      console.error(`   ❌ Failed: ${err.message}`);
      failed++;
    }
    if (i < toProcess.length - 1) await sleep(10000);  // 10s between books
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Done: ${succeeded} succeeded, ${failed} failed`);
  console.log('\nNext: npx tsx scripts/bible-validate.ts');
}

main().catch(console.error);
