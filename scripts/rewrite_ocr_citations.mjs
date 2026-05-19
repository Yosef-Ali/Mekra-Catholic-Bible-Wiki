#!/usr/bin/env node
// Sweep every wiki/ page and rewrite OCR citations to canonical digital paths.
//
//   `- `raw/catechism/extracted/<file>.md` (Q105 — description)`
//     → `- `raw/catechism-digital/Q105.md` (Q105 — description)`
//
//   `- `raw/catechism/qa_index.json` (Q252-264 — full baptism block)`
//     → DROP (qa_index.json is being removed along with the OCR archive)
//
//   `- `raw/catechism/extracted/<file>.md`` (no Q-number hint)
//     → DROP (redundant — the page's frontmatter already declares its Q range)
//
// Deduplicates identical canonical refs within the same Sources block.
//
// Usage:
//   node scripts/rewrite_ocr_citations.mjs              # apply
//   node scripts/rewrite_ocr_citations.mjs --dry-run    # report only

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIKI_DIR = path.join(ROOT, 'wiki');
const DRY_RUN = process.argv.includes('--dry-run');

async function* walk(dir) {
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith('.md')) yield full;
  }
}

// Extract the first explicit Q-number (digits only, e.g. "Q105") from text.
function firstQNum(s) {
  const m = s.match(/Q(\d{1,3})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function rewriteLine(line) {
  // Match a Sources bullet that references raw/catechism/...
  // Two interesting forms:
  //  - `raw/catechism/extracted/<...>.md` (...description maybe Q###...)
  //  - `raw/catechism/qa_index.json` (...description...)
  const m = line.match(/^(\s*-\s*)`(raw\/catechism\/[^`]+)`(.*)$/);
  if (!m) return { kept: line, dropped: false };
  const [, lead, refPath, tail] = m;
  // qa_index.json → always drop (file being deleted)
  if (refPath.includes('qa_index.json')) return { kept: null, dropped: true };
  // Extracted markdown — needs a Q-number to map to canonical
  const qNum = firstQNum(tail);
  if (!qNum) return { kept: null, dropped: true };
  if (qNum === 417) return { kept: null, dropped: true };  // absent in publisher's source
  const id = String(qNum).padStart(3, '0');
  return { kept: `${lead}\`raw/catechism-digital/Q${id}.md\`${tail}`, dropped: false };
}

function rewriteFile(content) {
  // Operate inside `## Sources` (and tolerate any later heading or end-of-file).
  // We split the file at `## Sources` and process only the tail.
  const idx = content.indexOf('\n## Sources');
  if (idx < 0) return { content, changed: false, rewritten: 0, dropped: 0 };

  const head = content.slice(0, idx);
  const tail = content.slice(idx);
  const lines = tail.split('\n');
  const out = [];
  const seen = new Set();
  let rewritten = 0;
  let dropped = 0;

  for (const line of lines) {
    const { kept, dropped: wasDropped } = rewriteLine(line);
    if (wasDropped) { dropped++; continue; }
    if (kept !== line) {
      rewritten++;
      // Dedupe by canonical-path (the bullet's primary `path`)
      const pathM = kept.match(/`(raw\/catechism-digital\/Q\d+\.md)`/);
      const key = pathM ? pathM[1] : kept;
      if (seen.has(key)) { dropped++; continue; }
      seen.add(key);
    }
    out.push(kept);
  }

  const newTail = out.join('\n');
  return {
    content: head + newTail,
    changed: rewritten > 0 || dropped > 0,
    rewritten,
    dropped,
  };
}

async function main() {
  let filesScanned = 0, filesChanged = 0, totalRewritten = 0, totalDropped = 0;
  for await (const fpath of walk(WIKI_DIR)) {
    filesScanned++;
    const original = fs.readFileSync(fpath, 'utf8');
    const { content: updated, changed, rewritten, dropped } = rewriteFile(original);
    if (!changed) continue;
    filesChanged++;
    totalRewritten += rewritten;
    totalDropped += dropped;
    console.log(`  ${path.relative(ROOT, fpath)} (rewrote ${rewritten}, dropped ${dropped})`);
    if (!DRY_RUN) fs.writeFileSync(fpath, updated);
  }
  console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}files scanned: ${filesScanned}`);
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}files changed: ${filesChanged}`);
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}citations rewritten to raw/catechism-digital/: ${totalRewritten}`);
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}citations dropped (qa_index.json, bare scans, dedupe): ${totalDropped}`);
}

main();
