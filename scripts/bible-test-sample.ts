/**
 * SAMPLE TEST — Run this before the full pipeline.
 * Uploads the PDF and extracts ONE chapter to verify:
 *   ✅ Gemini is reading the PDF natively (not script-side)
 *   ✅ Strict transcription (no AI fill)
 *   ✅ Format: prose/poetry, paragraph breaks, subtitles
 *
 * Usage:
 *   npx tsx scripts/bible-test-sample.ts                  # Genesis ch.1 (default)
 *   npx tsx scripts/bible-test-sample.ts 9 14 1           # pages 9-14, chapter 1
 *
 * Output: extraction_output/test_sample.json + printed summary
 */

import 'dotenv/config';
import { GoogleGenAI, createPartFromUri } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

import {
  buildSystemPrompt,
  requireEnv, PDF_PATH, OUTPUT_DIR,
} from './bible-shared';

const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');
const MODEL = 'gemini-3-flash-preview';
const SAMPLE_OUT = path.join(OUTPUT_DIR, 'test_sample.json');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ─── Slice PDF pages and upload to Files API ──────────────────────────────────

async function uploadSlice(ai: GoogleGenAI, startPage: number, endPage: number): Promise<{ uri: string; name: string }> {
  if (!fs.existsSync(PDF_PATH)) throw new Error(`PDF not found: ${PDF_PATH}`);

  console.log(`✂️  Slicing pages ${startPage}–${endPage} from PDF...`);
  const fullPdf = await PDFDocument.load(fs.readFileSync(PDF_PATH));
  const totalPages = fullPdf.getPageCount();
  console.log(`   PDF has ${totalPages} total pages`);

  const clipped = await PDFDocument.create();
  const start = Math.max(0, startPage - 1);
  const end   = Math.min(totalPages - 1, endPage - 1);
  const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const copied = await clipped.copyPages(fullPdf, indices);
  copied.forEach(p => clipped.addPage(p));

  const bytes = await clipped.save();
  const sizeMB = (bytes.length / 1_048_576).toFixed(1);
  console.log(`   Slice: ${indices.length} pages (${sizeMB} MB) → uploading to Gemini Files API\n`);

  const fileBlob = new Blob([bytes], { type: 'application/pdf' });
  const uploaded = await ai.files.upload({ file: fileBlob, config: { displayName: `bible-test-slice.pdf` } });

  // Wait for ACTIVE state
  let info = await ai.files.get({ name: uploaded.name! });
  while (info.state === 'PROCESSING') {
    await new Promise(r => setTimeout(r, 2000));
    info = await ai.files.get({ name: uploaded.name! });
  }
  if (info.state === 'FAILED') throw new Error('File processing failed in Gemini Files API');

  return { uri: uploaded.uri!, name: uploaded.name! };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args       = process.argv.slice(2);
  const startPage  = args[0] ? parseInt(args[0]) : 9;
  const endPage    = args[1] ? parseInt(args[1]) : 14;
  const chapterNum = args[2] ? parseInt(args[2]) : 1;

  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  Amharic Bible — Sample Extraction Test');
  console.log(`  Pages ${startPage}–${endPage} | Chapter ${chapterNum}`);
  console.log(`  Model: ${MODEL} (native PDF vision)`);
  console.log('══════════════════════════════════════════════════════\n');

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Slice and upload to Files API
  const { uri, name: fileName } = await uploadSlice(ai, startPage, endPage);

  const userPrompt = `Extract chapter ${chapterNum} (ምዕራፍ ${chapterNum}) exactly as printed.
Transcribe every verse character-by-character. Do not add, remove, or change any word.
If chapter ${chapterNum} is not found, extract the first chapter you see.`;

  console.log(`🤖 Sending to ${MODEL}...`);
  console.log(`   Gemini reads the PDF page images — no script-side text parsing.\n`);

  const t0 = Date.now();

  const filePart = createPartFromUri(uri, 'application/pdf');
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ parts: [filePart, { text: userPrompt }] }],
    config: {
      systemInstruction: buildSystemPrompt(),
      responseMimeType: 'application/json',
      temperature: 0,
    },
  });

  // Clean up uploaded file
  await ai.files.delete({ name: fileName }).catch(() => {});

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const text = response.text;
  if (!text) throw new Error('Empty response from Gemini');
  const result  = JSON.parse(text);

  fs.writeFileSync(SAMPLE_OUT, JSON.stringify(result, null, 2));

  // ── Print summary ──────────────────────────────────────────────────────────
  console.log(`══════════════════════════════════════════════════════`);
  console.log(`  Results  (${elapsed}s)`);
  console.log(`══════════════════════════════════════════════════════\n`);

  for (const ch of result.chapters) {
    const allVerses = ch.sections.flatMap((s: any) => s.verses);
    const poetrySections   = ch.sections.filter((s: any) => s.type === 'poetry');
    const subtitleSections = ch.sections.filter((s: any) => s.subtitle_text);
    const paragraphStarts  = allVerses.filter((v: any) => v.is_new_paragraph).map((v: any) => v.verse_number);

    console.log(`📖 Chapter ${ch.chapter_number}`);
    console.log(`   Sections  : ${ch.sections.length}`);
    console.log(`   Verses    : ${allVerses.length}`);
    console.log(`   Poetry    : ${poetrySections.length > 0 ? `✅ ${poetrySections.length} section(s)` : '— none'}`);
    console.log(`   Subtitles : ${subtitleSections.length > 0 ? subtitleSections.map((s: any) => `"${s.subtitle_text}" [${s.subtitle_level}]`).join(', ') : '— none'}`);
    console.log(`   New ¶s at : verses ${paragraphStarts.join(', ')}`);
    console.log('');

    // Print first 5 verses as a spot-check
    console.log('   ── First 5 verses (spot-check) ──────────────────');
    for (const v of allVerses.slice(0, 5)) {
      const para   = v.is_new_paragraph ? '¶ ' : '  ';
      const indent = '  '.repeat(v.indent);
      console.log(`   ${para}[${String(v.verse_number).padStart(3)}] ${indent}${v.text}`);
    }

    // Print last 3 verses
    if (allVerses.length > 5) {
      console.log('   ...');
      for (const v of allVerses.slice(-3)) {
        const para = v.is_new_paragraph ? '¶ ' : '  ';
        console.log(`   ${para}[${String(v.verse_number).padStart(3)}] ${v.text}`);
      }
    }
    console.log('');
  }

  // Token usage
  const usage = (response as any).usageMetadata;
  if (usage) {
    console.log(`── Token usage ────────────────────────────────────────`);
    console.log(`   Input  : ${usage.promptTokenCount?.toLocaleString() ?? '—'}`);
    console.log(`   Output : ${usage.candidatesTokenCount?.toLocaleString() ?? '—'}`);
    console.log(`   Total  : ${usage.totalTokenCount?.toLocaleString() ?? '—'}`);
    console.log('');
  }

  console.log(`💾 Full result saved to: ${SAMPLE_OUT}`);
  console.log('\n✅ If the Amharic text looks correct, run the full pipeline:');
  console.log('   npx tsx scripts/bible-page-map.ts');
  console.log('   npx tsx scripts/bible-extract.ts');
}

main().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
