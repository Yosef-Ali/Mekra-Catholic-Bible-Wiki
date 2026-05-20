/**
 * Stage 3: Re-extract flagged chapters using gemini-2.5-pro (higher accuracy).
 * Only processes chapters marked as errors in the validation report.
 * Uses per-book PDF slices (same approach as bible-extract.ts) — no file_handle needed.
 *
 * Usage: npx tsx scripts/bible-review.ts
 * Requires: extraction_output/validation_report.json + extraction_output/page_map.json
 *           + extraction_output/raw/<book>.json
 */

import 'dotenv/config';
import { GoogleGenAI, createPartFromUri } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

import {
  type ExtractedChapter,
  buildSystemPrompt, cleanJsonResponse,
  sleep, requireEnv,
  PDF_PATH, RAW_DIR, MAP_PATH, REPORT_PATH,
} from './bible-shared';

const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');
const MODEL = 'gemini-3.1-pro-preview';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadBookSlice(
  ai: GoogleGenAI,
  bookName: string,
  startPage: number,
  endPage: number
): Promise<{ uri: string; name: string }> {
  const fullPdf = await PDFDocument.load(fs.readFileSync(PDF_PATH));
  const total = fullPdf.getPageCount();
  const start = Math.max(0, startPage - 1);
  const end   = Math.min(total - 1, endPage - 1);
  const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const clipped = await PDFDocument.create();
  const pages = await clipped.copyPages(fullPdf, indices);
  pages.forEach(p => clipped.addPage(p));
  const bytes = await clipped.save();

  const fileBlob = new Blob([bytes], { type: 'application/pdf' });
  const uploaded = await ai.files.upload({
    file: fileBlob,
    config: { displayName: `bible-review-${bookName}.pdf` },
  });

  let info = await ai.files.get({ name: uploaded.name! });
  while (info.state === 'PROCESSING') {
    await sleep(2000);
    info = await ai.files.get({ name: uploaded.name! });
  }
  if (info.state === 'FAILED') throw new Error(`File processing failed for ${bookName}`);
  await sleep(2000);

  return { uri: uploaded.uri!, name: uploaded.name! };
}

async function reExtractChapter(
  ai: GoogleGenAI,
  fileUri: string,
  bookName: string,
  amharicName: string,
  chapterNum: number,
  startPage: number,
  endPage: number
): Promise<ExtractedChapter | null> {
  const filePart = createPartFromUri(fileUri, 'application/pdf');

  const userPrompt = `Re-extract ONLY chapter ${chapterNum} of ${bookName} (${amharicName}), pages ${startPage}–${endPage}. Transcribe every verse. Return JSON only.`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [filePart, { text: userPrompt }] }],
        config: {
          systemInstruction: buildSystemPrompt(),
          temperature: 0,
        },
      });

      const rawText = response.text;
      if (!rawText) throw new Error('Empty response');

      const parsed = JSON.parse(cleanJsonResponse(rawText)) as { chapters: ExtractedChapter[] };
      return parsed.chapters.find(c => c.chapter_number === chapterNum) || parsed.chapters[0] || null;

    } catch (err: any) {
      console.error(`  ⚠️  Attempt ${attempt}/3: ${err.message}`);
      if (attempt < 3) await sleep(8000 * attempt);
    }
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  for (const [label, p] of [['report', REPORT_PATH], ['page map', MAP_PATH], ['PDF', PDF_PATH]] as const) {
    if (!fs.existsSync(p)) {
      console.error(`❌ Missing ${label}: ${p}`);
      process.exit(1);
    }
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
  const pageMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8')) as {
    books: { name: string; amharic: string; start_page: number; end_page: number }[];
  };

  // Only re-extract chapters with errors (not just warnings)
  const errorFlags = (report.flagged_chapters as { book: string; chapter: number; severity: string }[])
    .filter(f => f.severity === 'error');

  // Group by book → unique chapter numbers
  const toReview = new Map<string, Set<number>>();
  for (const flag of errorFlags) {
    if (!toReview.has(flag.book)) toReview.set(flag.book, new Set());
    if (flag.chapter > 0) toReview.get(flag.book)!.add(flag.chapter);
  }

  if (toReview.size === 0) {
    console.log('✅ No error-level flags — nothing to review. Run bible-seed.ts to seed the database.');
    return;
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  let fixed = 0;
  let stillBad = 0;

  const totalChapters = [...toReview.values()].reduce((s, v) => s + v.size, 0);
  console.log(`\n🔬 Reviewing ${totalChapters} chapter(s) with ${MODEL}\n`);

  for (const [bookName, chapterSet] of toReview) {
    const rawPath = `${RAW_DIR}/${bookName}.json`;
    if (!fs.existsSync(rawPath)) {
      console.error(`❌ Raw file not found: ${rawPath}`);
      continue;
    }

    const bookData = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
    const bookMeta = pageMap.books.find(b => b.name === bookName);
    if (!bookMeta) {
      console.error(`❌ Book not found in page map: ${bookName}`);
      continue;
    }

    // Upload book slice once for all chapters in this book
    let uploadedFileName: string | null = null;
    let fileUri: string;
    try {
      console.log(`\n📖 ${bookName} — uploading slice (pages ${bookMeta.start_page}–${bookMeta.end_page})...`);
      const uploaded = await uploadBookSlice(ai, bookName, bookMeta.start_page, bookMeta.end_page);
      uploadedFileName = uploaded.name;
      fileUri = uploaded.uri;
    } catch (err: any) {
      console.error(`  ❌ Upload failed: ${err.message}`);
      continue;
    }

    const amharicName: string = bookData.amharic_name;
    let changed = false;

    for (const chNum of [...chapterSet].sort((a, b) => a - b)) {
      console.log(`  📖 ${bookName} ch.${chNum}...`);

      const reviewed = await reExtractChapter(
        ai, fileUri,
        bookName, amharicName, chNum,
        bookMeta.start_page, bookMeta.end_page
      );

      if (!reviewed) {
        console.error(`  ❌ Still failed — keeping original`);
        stillBad++;
        continue;
      }

      // Replace the chapter in bookData
      const idx = bookData.chapters.findIndex((c: ExtractedChapter) => c.chapter_number === chNum);
      if (idx >= 0) {
        bookData.chapters[idx] = reviewed;
      } else {
        bookData.chapters.push(reviewed);
        bookData.chapters.sort((a: ExtractedChapter, b: ExtractedChapter) => a.chapter_number - b.chapter_number);
      }

      const verseCount = reviewed.sections.reduce((s, sec) => s + sec.verses.length, 0);
      console.log(`  ✅ Re-extracted: ${verseCount} verses`);
      fixed++;
      changed = true;

      await sleep(5000);
    }

    // Clean up uploaded file
    if (uploadedFileName) {
      await ai.files.delete({ name: uploadedFileName }).catch(() => {});
    }

    if (changed) {
      fs.writeFileSync(rawPath, JSON.stringify(bookData, null, 2));
      console.log(`  💾 Updated ${rawPath}`);
    }
  }

  console.log(`\n✅ Review complete: ${fixed} chapters fixed, ${stillBad} still flagged`);
  console.log('\nRe-run validation to confirm: npx tsx scripts/bible-validate.ts');
  console.log('Then seed: npx tsx scripts/bible-seed.ts');
}

main().catch(console.error);
