/**
 * Quick probe: Extract a single PDF page and ask Gemini what book/chapter it contains.
 * Usage: npx tsx scripts/bible-probe-page.ts <pdf_page_number>
 *
 * This helps determine the offset between printed page numbers and PDF page indices.
 */

import 'dotenv/config';
import { GoogleGenAI, createPartFromUri } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import { requireEnv, PDF_PATH, sleep } from './bible-shared';

const GEMINI_API_KEY = requireEnv('GEMINI_API_KEY');

async function probePage(pageNum: number): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const fullPdf = await PDFDocument.load(fs.readFileSync(PDF_PATH));
  const total = fullPdf.getPageCount();
  const idx = pageNum - 1; // 0-based
  if (idx < 0 || idx >= total) {
    console.error(`Page ${pageNum} out of range (1-${total})`);
    return;
  }

  const clipped = await PDFDocument.create();
  const [page] = await clipped.copyPages(fullPdf, [idx]);
  clipped.addPage(page);
  const bytes = await clipped.save();

  console.log(`Uploading PDF page ${pageNum} (index ${idx})...`);
  const fileBlob = new Blob([bytes], { type: 'application/pdf' });
  const uploaded = await ai.files.upload({
    file: fileBlob,
    config: { displayName: `probe-page-${pageNum}.pdf` },
  });

  let info = await ai.files.get({ name: uploaded.name! });
  while (info.state === 'PROCESSING') {
    await sleep(2000);
    info = await ai.files.get({ name: uploaded.name! });
  }

  const filePart = createPartFromUri(uploaded.uri!, 'application/pdf');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      role: 'user',
      parts: [filePart, {
        text: `What Bible book and chapter is on this page? Also tell me the printed page number if visible. Reply briefly: "Book: X, Chapter(s): Y, Printed page number: Z" or "Front matter / Table of Contents" if it's not Bible text.`
      }]
    }],
  });

  await ai.files.delete({ name: uploaded.name! }).catch(() => {});
  console.log(`PDF page ${pageNum}: ${response.text}`);
}

async function main() {
  const pages = process.argv.slice(2).map(Number).filter(n => !isNaN(n));
  if (pages.length === 0) {
    console.log('Usage: npx tsx scripts/bible-probe-page.ts <page1> [page2] ...');
    console.log('Example: npx tsx scripts/bible-probe-page.ts 1 9 133 140');
    return;
  }

  for (const p of pages) {
    await probePage(p);
    if (pages.indexOf(p) < pages.length - 1) await sleep(2000);
  }
}

main().catch(console.error);
