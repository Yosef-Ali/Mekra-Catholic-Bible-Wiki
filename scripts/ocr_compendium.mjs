#!/usr/bin/env node
// Batch OCR for the Amharic Compendium of the Catechism.
// Reads JPGs from raw/catechism/source_jpg/, writes markdown to raw/catechism/extracted/.
// Idempotent — skips files that already have a non-empty extracted/<basename>.md.
//
// Usage:
//   node scripts/ocr_compendium.mjs            # process all
//   node scripts/ocr_compendium.mjs --limit 2  # process only 2 (smoke test)
//   node scripts/ocr_compendium.mjs --only "compendium of the catecism of the catholics-2-page-b 1.jpg"

import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const VAULT  = '/Users/mekdesyared/Mekra-Catholic-Bible-Wiki';
const SRC    = path.join(VAULT, 'raw/catechism/source_jpg');
const OUT    = path.join(VAULT, 'raw/catechism/extracted');
const EXTRACTOR = '/Users/mekdesyared/amharic-ocr-extractor';
const MODEL  = 'gemini-3.1-flash-image-preview';
const CONCURRENCY = 4;

// Pull the API key from the extractor's .env (VITE_GEMINI_API_KEY=...)
function loadApiKey() {
  const envPath = path.join(EXTRACTOR, '.env');
  const env = readFileSync(envPath, 'utf8');
  const m = env.match(/VITE_GEMINI_API_KEY\s*=\s*(\S+)/);
  if (!m) throw new Error(`GEMINI_API_KEY not found in ${envPath}`);
  return m[1];
}

// Load @google/genai from the extractor's node_modules
const require = createRequire(path.join(EXTRACTOR, 'package.json'));
const { GoogleGenAI } = require('@google/genai');

const client = new GoogleGenAI({ apiKey: loadApiKey() });

const PROMPT = `This image is a scanned page (or two-page spread) from the Amharic edition of the
"Compendium of the Catechism of the Catholic Church" — a Q&A-format book with 598
numbered questions across 4 parts (Creed, Sacraments, Commandments, Prayer).

Respond in this EXACT structure (no preamble, no code fences):

---
printed_page_left: <number printed at bottom of the left page, or "none" if blank/absent>
printed_page_right: <number printed at bottom of the right page, or "none" if single-page>
layout: spread | single
section_heading: <the running header text if visible, else "none">
needs_review: <yes | no>
needs_review_reason: <short reason, or "none">
---

# <first question number seen on this page, or "Front matter" / "TOC" if applicable>

## <question number>

**Q:** <Amharic question text>

**A:** <Amharic answer text>

[CCC <refs>]  ← only if marginal CCC paragraph references are visible

(repeat the ## / Q / A block for every question on the page)

STRICT RULES:
- Preserve question numbers exactly — Ethiopic (፩፪፫...) or Arabic (1,2,3...) — do not convert between them.
- Do NOT normalize Amharic spelling or modernize archaic forms. Preserve ሠ/ሰ, ሐ/ሀ/ኀ, ጸ/ፀ, አ/ዐ exactly as printed.
- Use Ethiopic punctuation (።, ፣, ፤) exactly as printed.
- If the page is front matter, TOC, preface, or contains no Q&A items, skip the ## / Q / A structure
  and transcribe the text verbatim under a single heading.
- If text is cut off at the edge, mark with [...] and set needs_review: yes.
- If you cannot read a word, use [?] for that word and set needs_review: yes.
- If the printed page number is partially visible or uncertain, put your best guess
  followed by "?" (e.g. "112?") and set needs_review: yes.`;

async function ocrOne(filename) {
  const srcPath = path.join(SRC, filename);
  const base    = filename.replace(/\.(jpe?g|png)$/i, '');
  const outPath = path.join(OUT, `${base}.md`);

  if (existsSync(outPath)) {
    const st = await stat(outPath);
    if (st.size > 0) return { filename, status: 'skipped' };
  }

  const buf = await readFile(srcPath);
  const b64 = buf.toString('base64');
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: b64 } },
        { text: PROMPT },
      ],
    }],
  });

  const text = response.text ?? '';
  if (!text.trim()) throw new Error('empty response');

  const header = `<!-- source: ${filename} -->\n<!-- model: ${MODEL} -->\n<!-- extracted_at: ${new Date().toISOString()} -->\n\n`;
  await writeFile(outPath, header + text, 'utf8');
  return { filename, status: 'ok', bytes: text.length };
}

// Parse CLI args
const args = process.argv.slice(2);
let limit = Infinity;
let only = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit') limit = Number(args[++i]);
  else if (args[i] === '--only') only = args[++i];
}

await mkdir(OUT, { recursive: true });
const all = (await readdir(SRC))
  .filter(f => /\.(jpe?g|png)$/i.test(f))
  .sort();
const files = (only ? all.filter(f => f === only) : all).slice(0, limit);

console.log(`OCR queue: ${files.length} / ${all.length} files, concurrency=${CONCURRENCY}`);

let done = 0, skipped = 0, errors = 0;
const queue = [...files];
async function worker(id) {
  while (queue.length) {
    const f = queue.shift();
    if (!f) return;
    try {
      const r = await ocrOne(f);
      if (r.status === 'skipped') skipped++;
      else done++;
      console.log(`[${done + skipped}/${files.length}] ${r.status} ${f}`);
    } catch (e) {
      errors++;
      console.error(`[ERR] ${f}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
console.log(`\nDone. ok=${done} skipped=${skipped} errors=${errors}`);
