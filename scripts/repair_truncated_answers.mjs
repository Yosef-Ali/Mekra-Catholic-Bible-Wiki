#!/usr/bin/env node
/**
 * repair_truncated_answers.mjs
 *
 * Finds every qa_index.json entry whose answer contains "[...]", "[..]", or "[…]",
 * re-OCRs that entry using both the source page image AND the next page image
 * (since truncation always means the answer continued onto the following scan),
 * patches qa_index.json with the completed answer, then regenerates the teaching
 * .md files and re-syncs to Neon DB.
 *
 * Usage:
 *   node scripts/repair_truncated_answers.mjs            # repair all 43
 *   node scripts/repair_truncated_answers.mjs --dry-run  # show plan, no writes
 *   node scripts/repair_truncated_answers.mjs --only 12  # repair just Q12
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT      = path.join(__dirname, '..');
const QA_INDEX   = path.join(VAULT, 'raw/catechism/qa_index.json');
const PAGE_MAP   = path.join(VAULT, 'raw/catechism/page_map.json');
const EXTRACTED  = path.join(VAULT, 'raw/catechism/extracted');
const SOURCE_JPG = path.join(VAULT, 'raw/catechism/source_jpg');
const EXTRACTOR  = '/Users/mekdesyared/amharic-ocr-extractor';
const MODEL      = 'gemini-3.1-flash-image-preview';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const onlyIdx  = args.indexOf('--only');
const ONLY_Q   = onlyIdx >= 0 ? parseInt(args[onlyIdx + 1], 10) : null;

// ── Load Gemini ───────────────────────────────────────────────────────────────
function loadApiKey() {
  const envPath = path.join(EXTRACTOR, '.env');
  const env = readFileSync(envPath, 'utf8');
  const m = env.match(/VITE_GEMINI_API_KEY\s*=\s*(\S+)/);
  if (!m) throw new Error(`GEMINI_API_KEY not found in ${envPath}`);
  return m[1];
}
const require = createRequire(path.join(EXTRACTOR, 'package.json'));
const { GoogleGenAI } = require('@google/genai');
const client = new GoogleGenAI({ apiKey: loadApiKey() });

// ── Helpers ───────────────────────────────────────────────────────────────────
function isTruncated(answer = '') {
  return answer.includes('[...]') || answer.includes('[..]') || answer.includes('[…]');
}

/** Read the <!-- source: ... --> comment from an extracted .md file */
function readSourceImage(mdFile) {
  const full = path.join(EXTRACTED, mdFile);
  if (!existsSync(full)) return null;
  const txt = readFileSync(full, 'utf8');
  const m = txt.match(/<!--\s*source:\s*(.+?)\s*-->/);
  return m ? m[1] : null; // e.g. "compendium ... 26.jpg"
}

/** Find the image file in source_jpg — try .jpg then .png */
function findImage(basename) {
  for (const ext of ['.jpg', '.jpeg', '.png']) {
    const p = path.join(SOURCE_JPG, basename.replace(/\.[^.]+$/, '') + ext);
    if (existsSync(p)) return p;
    // basename may already have extension
    const p2 = path.join(SOURCE_JPG, basename);
    if (existsSync(p2)) return p2;
  }
  return null;
}

/** Ask Gemini for the complete answer of qNum given two page images */
async function repairAnswer(qNum, currentAnswer, imgPath1, imgPath2) {
  const parts = [];

  async function addImage(imgPath) {
    if (!imgPath || !existsSync(imgPath)) return;
    const data = await readFile(imgPath);
    const mime = imgPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    parts.push({ inlineData: { mimeType: mime, data: data.toString('base64') } });
  }

  await addImage(imgPath1);
  await addImage(imgPath2);

  if (parts.length === 0) throw new Error('No images available');

  const prompt = `These images are consecutive scanned pages from the Amharic edition of the
"Compendium of the Catechism of the Catholic Church".

I need the COMPLETE Amharic answer for Question ${qNum}.
The current (truncated) answer text is:
"${currentAnswer}"

The answer was cut off at the end of the first page and continues on the second page.

Return ONLY the complete Amharic answer text — no preamble, no Q/A labels, no CCC refs,
no markdown formatting. Just the raw Amharic answer text as a single paragraph.

STRICT RULES:
- Do NOT normalize spelling: preserve ሠ/ሰ, ሐ/ሀ/ኀ, ጸ/ፀ, አ/ዐ exactly as printed.
- Preserve Ethiopic punctuation (።, ፣, ፤, ::) exactly as printed.
- Do NOT include the question text, only the answer.
- Do NOT include CCC reference numbers.
- If you cannot read part of the text, use [?] for that word.`;

  parts.push({ text: prompt });

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.1 },
  });

  return response.text.trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🔧 Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}${ONLY_Q ? ` (Q${ONLY_Q} only)` : ''}`);

  const qaData  = JSON.parse(await readFile(QA_INDEX, 'utf8'));
  const pageMap = JSON.parse(await readFile(PAGE_MAP, 'utf8'));

  // Build a list sorted by the smallest printed page number in each entry.
  // page_map entries are NOT in book-page order (files were scanned non-linearly),
  // so we must sort by printed page number to find the true "next page".
  const entries = pageMap.entries;

  function entryMinPage(e) {
    const left  = e.left?.n  ?? Infinity;
    const right = e.right?.n ?? Infinity;
    return Math.min(left, right);
  }
  const sorted = [...entries].sort((a, b) => entryMinPage(a) - entryMinPage(b));

  // file → index in the page-sorted array
  const fileIndex = new Map(sorted.map((e, i) => [e.file, i]));

  // Find truncated entries
  const truncated = qaData.filter(e =>
    isTruncated(e.answer) && (ONLY_Q === null || e.q === ONLY_Q)
  );
  console.log(`📋 Truncated entries to repair: ${truncated.length}`);

  let fixed = 0, failed = 0;

  for (const entry of truncated) {
    const qNum  = entry.q;
    const src   = entry.source; // e.g. "compendium ... 26.md"
    console.log(`\nQ${qNum}: ${src}`);
    console.log(`  Current: ...${entry.answer.slice(-80)}`);

    // Find source image
    const srcImageName = readSourceImage(src);
    const imgPath1     = srcImageName ? findImage(srcImageName) : null;

    // Find next page image (by printed page number, not file-name order)
    const srcIdx  = fileIndex.get(src);
    let imgPath2  = null;
    if (srcIdx !== undefined && srcIdx + 1 < sorted.length) {
      const nextFile      = sorted[srcIdx + 1].file;
      const nextImageName = readSourceImage(nextFile);
      if (nextImageName) imgPath2 = findImage(nextImageName);
      console.log(`  Next page (p.${entryMinPage(sorted[srcIdx + 1])}): ${nextFile}`);
    }

    if (!imgPath1) {
      console.warn(`  ⚠️  Source image not found for ${src} — skipping`);
      failed++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry] img1=${imgPath1 ? path.basename(imgPath1) : 'MISSING'} img2=${imgPath2 ? path.basename(imgPath2) : 'MISSING'}`);
      continue;
    }

    try {
      const completed = await repairAnswer(qNum, entry.answer, imgPath1, imgPath2);
      console.log(`  ✓ Completed (${completed.length} chars): ${completed.slice(0, 80)}…`);
      entry.answer = completed;
      fixed++;
    } catch (err) {
      console.error(`  ✗ Q${qNum} failed: ${err.message}`);
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n📊 Done. fixed=${fixed} failed=${failed}`);

  if (!DRY_RUN && fixed > 0) {
    // Persist updated qa_index.json
    await writeFile(QA_INDEX, JSON.stringify(qaData, null, 2), 'utf8');
    console.log(`✅ qa_index.json updated`);

    // Regenerate teaching markdown files
    console.log(`\n🔄 Regenerating teaching pages…`);
    execSync(`node ${path.join(__dirname, 'generate_teaching_pages.mjs')}`, {
      cwd: VAULT, stdio: 'inherit',
    });

    // Re-sync to Neon DB (force to overwrite content_hash matches)
    console.log(`\n🔄 Syncing to Neon DB…`);
    execSync(`node ${path.join(__dirname, 'sync_to_db.mjs')} --force --type teaching`, {
      cwd: VAULT, stdio: 'inherit',
    });

    console.log(`\n✅ All done! ${fixed} answers repaired and synced.`);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
