/**
 * Helper: Build a page map of all 73 Bible books with their actual PDF page indices.
 *
 * Strategy: Upload the PDF in chunks (100 PDF pages each) and ask Gemini to
 * identify every book that STARTS within that chunk and on which page of the
 * chunk. This avoids relying on printed page numbers from the TOC (which don't
 * match PDF page indices due to two-page spreads and divider pages).
 *
 * Usage: npx tsx scripts/bible-page-map.ts
 * Output: extraction_output/page_map.json
 */

import 'dotenv/config';
import { GoogleGenAI, createPartFromUri } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

import { requireEnv, sleep, PDF_PATH, OUTPUT_DIR, MAP_PATH } from './bible-shared';

const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');
const CHUNK_SIZE = 100; // PDF pages per chunk

// All 73 books of the Catholic Bible in canonical order with Amharic names
const BOOKS = [
  { name: 'Genesis',          amharic: 'ኦሪት ዘፍጥረት',     expected_chapters: 50 },
  { name: 'Exodus',           amharic: 'ኦሪት ዘፀአት',       expected_chapters: 40 },
  { name: 'Leviticus',        amharic: 'ኦሪት ዘሌዋውያን',    expected_chapters: 27 },
  { name: 'Numbers',          amharic: 'ኦሪት ዘኍልቍ',      expected_chapters: 36 },
  { name: 'Deuteronomy',      amharic: 'ኦሪት ዘዳግም',      expected_chapters: 34 },
  { name: 'Joshua',           amharic: 'መጽሐፈ ኢያሱ',      expected_chapters: 24 },
  { name: 'Judges',           amharic: 'መጽሐፈ መሣፍንት',    expected_chapters: 21 },
  { name: 'Ruth',             amharic: 'መጽሐፈ ሩት',       expected_chapters: 4  },
  { name: '1_Samuel',        amharic: '1ኛ ሳሙኤል',        expected_chapters: 31 },
  { name: '2_Samuel',        amharic: '2ኛ ሳሙኤል',        expected_chapters: 24 },
  { name: '1_Kings',         amharic: '1ኛ ነገሥት',         expected_chapters: 22 },
  { name: '2_Kings',         amharic: '2ኛ ነገሥት',         expected_chapters: 25 },
  { name: '1_Chronicles',    amharic: '1ኛ ዜና መዋዕል',     expected_chapters: 29 },
  { name: '2_Chronicles',    amharic: '2ኛ ዜና መዋዕል',     expected_chapters: 36 },
  { name: 'Ezra',             amharic: 'መጽሐፈ ዕዝራ',      expected_chapters: 10 },
  { name: 'Nehemiah',         amharic: 'መጽሐፈ ነህምያ',     expected_chapters: 13 },
  { name: 'Tobit',            amharic: 'መጽሐፈ ጦቢት',      expected_chapters: 14 },
  { name: 'Judith',           amharic: 'መጽሐፈ ይሁዲት',    expected_chapters: 16 },
  { name: 'Esther',           amharic: 'መጽሐፈ አስቴር',     expected_chapters: 10 },
  { name: '1_Maccabees',     amharic: '1ኛ መቃብያን',       expected_chapters: 16 },
  { name: '2_Maccabees',     amharic: '2ኛ መቃብያን',       expected_chapters: 15 },
  { name: 'Job',              amharic: 'መጽሐፈ ኢዮብ',      expected_chapters: 42 },
  { name: 'Psalms',           amharic: 'መዝሙረ ዳዊት',      expected_chapters: 150},
  { name: 'Proverbs',         amharic: 'መጽሐፈ ምሳሌ',      expected_chapters: 31 },
  { name: 'Ecclesiastes',     amharic: 'መጽሐፈ መክብብ',     expected_chapters: 12 },
  { name: 'Song_of_Songs',   amharic: 'መኃልየ መኃልይ',     expected_chapters: 8  },
  { name: 'Wisdom',           amharic: 'መጽሐፈ ጥበብ',      expected_chapters: 19 },
  { name: 'Sirach',           amharic: 'መጽሐፈ ሲራክ',      expected_chapters: 51 },
  { name: 'Isaiah',           amharic: 'ትንቢተ ኢሳይያስ',    expected_chapters: 66 },
  { name: 'Jeremiah',         amharic: 'ትንቢተ ኤርምያስ',    expected_chapters: 52 },
  { name: 'Lamentations',     amharic: 'ሰቆቃወ ኤርምያስ',    expected_chapters: 5  },
  { name: 'Baruch',           amharic: 'መጽሐፈ ባሮክ',      expected_chapters: 6  },
  { name: 'Ezekiel',          amharic: 'ትንቢተ ሕዝቅኤል',    expected_chapters: 48 },
  { name: 'Daniel',           amharic: 'ትንቢተ ዳንኤል',     expected_chapters: 14 },
  { name: 'Hosea',            amharic: 'ትንቢተ ሆሴዕ',      expected_chapters: 14 },
  { name: 'Joel',             amharic: 'ትንቢተ ኢዩኤል',     expected_chapters: 4  },
  { name: 'Amos',             amharic: 'ትንቢተ አሞጽ',      expected_chapters: 9  },
  { name: 'Obadiah',          amharic: 'ትንቢተ አብድዩ',     expected_chapters: 1  },
  { name: 'Jonah',            amharic: 'ትንቢተ ዮናስ',      expected_chapters: 4  },
  { name: 'Micah',            amharic: 'ትንቢተ ሚክያስ',     expected_chapters: 7  },
  { name: 'Nahum',            amharic: 'ትንቢተ ናሆም',      expected_chapters: 3  },
  { name: 'Habakkuk',         amharic: 'ትንቢተ ዕንባቆም',    expected_chapters: 3  },
  { name: 'Zephaniah',        amharic: 'ትንቢተ ሶፎንያስ',    expected_chapters: 3  },
  { name: 'Haggai',           amharic: 'ትንቢተ ሐጌ',       expected_chapters: 2  },
  { name: 'Zechariah',        amharic: 'ትንቢተ ዘካርያስ',    expected_chapters: 14 },
  { name: 'Malachi',          amharic: 'ትንቢተ ሚልክያስ',    expected_chapters: 4  },
  { name: 'Matthew',          amharic: 'የማቴዎስ ወንጌል',    expected_chapters: 28 },
  { name: 'Mark',             amharic: 'የማርቆስ ወንጌል',    expected_chapters: 16 },
  { name: 'Luke',             amharic: 'የሉቃስ ወንጌል',     expected_chapters: 24 },
  { name: 'John',             amharic: 'የዮሐንስ ወንጌል',    expected_chapters: 21 },
  { name: 'Acts',             amharic: 'የሐዋርያት ሥራ',     expected_chapters: 28 },
  { name: 'Romans',           amharic: 'ወደ ሮሜ ሰዎች',     expected_chapters: 16 },
  { name: '1_Corinthians',   amharic: '1ኛ ወደ ቆሮንቶስ',   expected_chapters: 16 },
  { name: '2_Corinthians',   amharic: '2ኛ ወደ ቆሮንቶስ',   expected_chapters: 13 },
  { name: 'Galatians',        amharic: 'ወደ ገላትያ',       expected_chapters: 6  },
  { name: 'Ephesians',        amharic: 'ወደ ኤፌሶን',       expected_chapters: 6  },
  { name: 'Philippians',      amharic: 'ወደ ፊልጵስዩስ',     expected_chapters: 4  },
  { name: 'Colossians',       amharic: 'ወደ ቆላስይስ',      expected_chapters: 4  },
  { name: '1_Thessalonians', amharic: '1ኛ ወደ ተሰሎንቄ',   expected_chapters: 5  },
  { name: '2_Thessalonians', amharic: '2ኛ ወደ ተሰሎንቄ',   expected_chapters: 3  },
  { name: '1_Timothy',       amharic: '1ኛ ወደ ጢሞቴዎስ',   expected_chapters: 6  },
  { name: '2_Timothy',       amharic: '2ኛ ወደ ጢሞቴዎስ',   expected_chapters: 4  },
  { name: 'Titus',            amharic: 'ወደ ቲቶ',         expected_chapters: 3  },
  { name: 'Philemon',         amharic: 'ወደ ፊሊሞና',       expected_chapters: 1  },
  { name: 'Hebrews',          amharic: 'ወደ ዕብራውያን',     expected_chapters: 13 },
  { name: 'James',            amharic: 'የያዕቆብ መልእክት',   expected_chapters: 5  },
  { name: '1_Peter',         amharic: '1ኛ የጴጥሮስ',       expected_chapters: 5  },
  { name: '2_Peter',         amharic: '2ኛ የጴጥሮስ',       expected_chapters: 3  },
  { name: '1_John',          amharic: '1ኛ የዮሐንስ',       expected_chapters: 5  },
  { name: '2_John',          amharic: '2ኛ የዮሐንስ',       expected_chapters: 1  },
  { name: '3_John',          amharic: '3ኛ የዮሐንስ',       expected_chapters: 1  },
  { name: 'Jude',             amharic: 'የይሁዳ መልእክት',    expected_chapters: 1  },
  { name: 'Revelation',       amharic: 'የዮሐንስ ራዕይ',     expected_chapters: 22 },
];

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Upload a chunk and ask Gemini what books start in it ───────────────────

async function scanChunk(
  ai: GoogleGenAI,
  fullPdf: PDFDocument,
  chunkStart: number,  // 1-based PDF page
  chunkEnd: number,
): Promise<{ name: string; amharic: string; pdf_page: number }[]> {
  const total = fullPdf.getPageCount();
  const startIdx = Math.max(0, chunkStart - 1);
  const endIdx = Math.min(total - 1, chunkEnd - 1);
  const indices = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => startIdx + i);

  const clipped = await PDFDocument.create();
  const pages = await clipped.copyPages(fullPdf, indices);
  pages.forEach(p => clipped.addPage(p));
  const bytes = await clipped.save();

  const sizeMB = (bytes.length / 1_048_576).toFixed(1);
  console.log(`   Uploading chunk PDF pages ${chunkStart}–${chunkEnd} (${sizeMB} MB)...`);

  const fileBlob = new Blob([bytes], { type: 'application/pdf' });
  const uploaded = await ai.files.upload({
    file: fileBlob,
    config: { displayName: `bible-chunk-${chunkStart}-${chunkEnd}.pdf` },
  });

  let info = await ai.files.get({ name: uploaded.name! });
  while (info.state === 'PROCESSING') {
    await sleep(2000);
    info = await ai.files.get({ name: uploaded.name! });
  }
  if (info.state === 'FAILED') throw new Error(`Chunk ${chunkStart}-${chunkEnd} processing failed`);

  const filePart = createPartFromUri(uploaded.uri!, 'application/pdf');

  const prompt = `This PDF contains pages from an Amharic Catholic Bible.
This chunk covers PDF pages ${chunkStart} through ${chunkEnd} of the full Bible PDF.

IMPORTANT: This PDF has TWO-PAGE SPREADS — each PDF page shows 2 printed pages side by side.

Scan through this chunk and identify EVERY Bible book whose FIRST chapter (chapter 1) begins somewhere in these pages.
Look for book title headings — they typically appear as large centered text before chapter 1.

For each book found, report:
1. The standard English name (e.g., Genesis, Exodus, Ruth, Matthew, etc.)
2. The Amharic name as printed
3. The PDF page number within the FULL Bible PDF where the book's title/chapter 1 first appears.
   Since this chunk starts at PDF page ${chunkStart}, the first page of this chunk = PDF page ${chunkStart},
   the second page = PDF page ${chunkStart + 1}, etc.

Return JSON only:
{"books": [{"name": "BookName", "amharic": "አማርኛ ስም", "pdf_page": <absolute PDF page number>}]}

Rules:
- Only report books whose BEGINNING (title + chapter 1) you can see in this chunk
- Do NOT report books that are mid-chapter (already started in an earlier chunk)
- pdf_page must be the absolute page in the full 700-page PDF, not the page within this chunk
- If no new books start in this chunk, return {"books": []}`;

  let response;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [filePart, { text: prompt }] }],
        config: { temperature: 0 },
      });
      break;
    } catch (err: any) {
      console.error(`  ⚠️  Attempt ${attempt}/3: ${err.message}`);
      if (attempt < 3) await sleep(5000 * attempt);
      else throw err;
    }
  }

  // Clean up
  await ai.files.delete({ name: uploaded.name! }).catch(() => {});

  const rawText = response!.text!.trim();
  // Strip markdown fences if present
  let jsonText = rawText;
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed = JSON.parse(jsonText) as { books: { name: string; amharic: string; pdf_page: number }[] };
  return parsed.books;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`❌ PDF not found: ${PDF_PATH}`);
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const fullPdf = await PDFDocument.load(fs.readFileSync(PDF_PATH));
  const totalPages = fullPdf.getPageCount();

  console.log(`📖 Bible PDF: ${totalPages} pages`);
  console.log(`🔍 Scanning in ${Math.ceil(totalPages / CHUNK_SIZE)} chunks of ${CHUNK_SIZE} pages...\n`);

  const allFound: { name: string; amharic: string; pdf_page: number }[] = [];

  for (let start = 1; start <= totalPages; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, totalPages);
    console.log(`\n📄 Chunk: PDF pages ${start}–${end}`);

    try {
      const books = await scanChunk(ai, fullPdf, start, end);
      for (const b of books) {
        console.log(`   ✅ Found: ${b.name} (${b.amharic}) at PDF page ${b.pdf_page}`);
        allFound.push(b);
      }
      if (books.length === 0) {
        console.log(`   (no new books start in this range)`);
      }
    } catch (err: any) {
      console.error(`   ❌ Chunk failed: ${err.message}`);
    }

    if (start + CHUNK_SIZE <= totalPages) await sleep(3000);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Found ${allFound.length} books across all chunks\n`);

  // Normalize names: match against canonical BOOKS list
  const normalizeMap = new Map<string, typeof BOOKS[0]>();
  for (const b of BOOKS) {
    normalizeMap.set(b.name.toLowerCase(), b);
    normalizeMap.set(b.name.toLowerCase().replace(/_/g, ' '), b);
    normalizeMap.set(b.name.toLowerCase().replace(/_/g, ''), b);
  }
  // Common Gemini name variants
  normalizeMap.set('song of solomon', BOOKS.find(b => b.name === 'Song_of_Songs')!);
  normalizeMap.set('wisdom of solomon', BOOKS.find(b => b.name === 'Wisdom')!);

  // Build the page map, merging found data with canonical book list
  const foundByName = new Map<string, { pdf_page: number; amharic: string }>();
  for (const f of allFound) {
    // Normalize the found name
    const key = f.name.toLowerCase().replace(/\s+/g, '_');
    const canon = normalizeMap.get(key) || normalizeMap.get(f.name.toLowerCase());
    const name = canon?.name || f.name;
    // Keep the first occurrence (in case of duplicates)
    if (!foundByName.has(name)) {
      foundByName.set(name, { pdf_page: f.pdf_page, amharic: f.amharic });
    }
  }

  // Build final page map in canonical order
  const pageMap: {
    name: string; amharic: string;
    start_page: number; end_page: number | null;
    expected_chapters: number;
  }[] = [];

  for (const b of BOOKS) {
    const found = foundByName.get(b.name);
    pageMap.push({
      name: b.name,
      amharic: found?.amharic || b.amharic,
      start_page: found?.pdf_page || 0,
      end_page: null, // will be computed below
      expected_chapters: b.expected_chapters,
    });
  }

  // Compute end_page: next book's start_page - 1
  for (let i = 0; i < pageMap.length; i++) {
    if (i < pageMap.length - 1) {
      const nextStart = pageMap[i + 1].start_page;
      if (nextStart > 0 && pageMap[i].start_page > 0) {
        pageMap[i].end_page = Math.max(nextStart - 1, pageMap[i].start_page);
      }
    } else {
      // Last book: extends to last PDF page (or near it)
      if (pageMap[i].start_page > 0) {
        pageMap[i].end_page = totalPages;
      }
    }
  }

  // Report
  const found = pageMap.filter(b => b.start_page > 0).length;
  const missing = pageMap.filter(b => b.start_page === 0).map(b => b.name);
  console.log(`✅ Mapped ${found} / ${BOOKS.length} books`);

  if (missing.length > 0) {
    console.log(`⚠️  Missing (need manual fix): ${missing.join(', ')}`);
  }

  // Show summary
  for (const b of pageMap) {
    if (b.start_page > 0) {
      console.log(`  ${b.name.padEnd(20)} PDF ${b.start_page}–${b.end_page || '?'} (${b.expected_chapters} ch)`);
    } else {
      console.log(`  ${b.name.padEnd(20)} ❌ NOT FOUND`);
    }
  }

  fs.writeFileSync(MAP_PATH, JSON.stringify({ books: pageMap }, null, 2));
  console.log(`\n💾 Saved to: ${MAP_PATH}`);
  console.log('\nNext step: npx tsx scripts/bible-extract.ts');
}

main().catch(console.error);
