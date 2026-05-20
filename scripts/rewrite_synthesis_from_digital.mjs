#!/usr/bin/env node
// Replace every `## Synthesis` section in wiki/teaching/ and wiki/concepts/ with
// a verbatim stitch from the canonical Compendium digital edition. The old
// Synthesis was AI-written paraphrase; the new one is exact publisher Amharic.
//
// Stitching rule:
//   - The page's frontmatter `**Compendium Q:**` declares which Q's it covers.
//   - We use the FIRST cited Q (the topic's definitional Q) as the Synthesis:
//       header attribution line + the full canonical answer.
//   - Footer line points readers to the page's Compendium Q&A section, which
//     already contains the full set of cited Q&As post `sync_qa_blocks_from_digital`.
//
// Skipped automatically:
//   - Pages with no `compendium_q` frontmatter (e.g. saints, places, themes).
//   - Pages whose only cited Q is Q417 (absent in publisher's source).
//   - Pages with no `## Synthesis` section.
//
// Idempotent — re-running produces no further changes once everything is
// aligned. Pair with sync_qa_blocks_from_digital.mjs for full canonicalisation.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIKI_DIR = path.join(ROOT, 'wiki');
const DIGITAL_DIR = path.join(ROOT, 'raw/catechism-digital');
const TARGET_TYPES = new Set(['teaching', 'concepts']);
const DRY_RUN = process.argv.includes('--dry-run');

// Parse compendium_q like "363–365, 410, 420" → [363, 364, 365, 410, 420]
function parseQList(s) {
  if (!s) return [];
  const out = [];
  for (const tok of s.split(/[,;]/)) {
    const trimmed = tok.trim().replace(/^Q/i, '');
    const range = trimmed.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (range) {
      const a = +range[1], b = +range[2];
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(i);
      continue;
    }
    const single = trimmed.match(/^(\d+)$/);
    if (single) out.push(+single[1]);
  }
  return [...new Set(out)];
}

// Load `raw/catechism-digital/QNNN.md` → { question, answerParagraphs[] }
function loadCanonical(qNum) {
  const id = String(qNum).padStart(3, '0');
  const fpath = path.join(DIGITAL_DIR, `Q${id}.md`);
  if (!fs.existsSync(fpath)) return null;
  const md = fs.readFileSync(fpath, 'utf8');
  const m = md.match(/## Question\s*\n([\s\S]*?)\n## Answer\s*\n([\s\S]*)$/);
  if (!m) return null;
  const question = m[1].trim().replace(/\s+/g, ' ');
  // Preserve paragraph breaks in the answer (blank-line separated).
  const answerParagraphs = m[2].trim()
    .split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return { question, answerParagraphs };
}

// Format a "Q363, 364, 365, 410, 420" → "Q363-365, Q410, Q420" (compact ranges).
function formatQList(qs) {
  if (qs.length === 0) return '';
  qs = [...qs].sort((a, b) => a - b);
  const groups = [];
  let start = qs[0], prev = qs[0];
  for (let i = 1; i < qs.length; i++) {
    if (qs[i] === prev + 1) { prev = qs[i]; continue; }
    groups.push(start === prev ? `Q${start}` : `Q${start}–${prev}`);
    start = prev = qs[i];
  }
  groups.push(start === prev ? `Q${start}` : `Q${start}–${prev}`);
  return groups.join(', ');
}

function buildSynthesis(_firstQ, firstQData, _restQList) {
  // End-user focus: no editorial attribution. The Synthesis IS the canonical
  // Amharic answer, presented cleanly. Provenance is preserved via the per-Q
  // `### QNNN` blocks further down the page and via the frontmatter's
  // **Compendium Q:** field. A priest opening the page should see the answer,
  // not metadata about where it came from.
  //
  // Join publisher paragraphs with a single space — the `.pages` extraction
  // splits sentences across "paragraphs" due to column layout (e.g. Q363:
  // "…ይህንን ወይም ያንን | ነገር ለመሥራት…"). The per-Q blocks below preserve the
  // original breaks; the Synthesis flows as one paragraph for readability.
  const body = firstQData.answerParagraphs.join(' ').replace(/\s+/g, ' ').trim();
  return `## Synthesis\n\n${body}\n`;
}

// Replace the `## Synthesis` block (up to the next `## ` heading or end-of-file)
// with the new stitched version. Imperative slicing — robust against the
// /m-flag $-anchor pitfall that previously matched only the heading line.
function replaceSynthesisBlock(content, newBlock) {
  const synthIdx = content.search(/^## Synthesis\b/m);
  if (synthIdx < 0) return null;

  // Find the next heading that is NOT another "## Synthesis" heading.
  const headingRegex = /^#+ .+/gm;
  let match;
  let nextSectionIdx = -1;
  while ((match = headingRegex.exec(content)) !== null) {
    if (match.index > synthIdx) {
      const headingText = match[0].trim();
      if (!/^## Synthesis\b/.test(headingText)) {
        nextSectionIdx = match.index;
        break;
      }
    }
  }

  const endIdx = nextSectionIdx >= 0 ? nextSectionIdx : content.length;
  const head = content.slice(0, synthIdx);
  const tail = content.slice(endIdx);

  // Normalise spacing: exactly one blank line between the new Synthesis block
  // and the next heading.
  return head + newBlock.replace(/\n*$/, '') + '\n\n' + tail.replace(/^\n+/, '');
}

async function* walk(dir) {
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith('.md')) yield full;
  }
}

function pageType(fpath) {
  const rel = path.relative(WIKI_DIR, fpath);
  return rel.split(path.sep)[0]; // teaching | concept | figures | …
}

function readCompendiumQ(content) {
  const m = content.match(/^\*\*Compendium\s+Q:\*\*\s*(.+)$/m);
  return m ? m[1].trim() : '';
}

async function main() {
  let filesScanned = 0, filesChanged = 0, skippedNoQ = 0, skippedNoSynthesis = 0, skippedNoCanonical = 0;
  const missingQs = new Set();

  for await (const fpath of walk(WIKI_DIR)) {
    if (!TARGET_TYPES.has(pageType(fpath))) continue;
    filesScanned++;
    const original = fs.readFileSync(fpath, 'utf8');
    const compQ = readCompendiumQ(original);
    const qList = parseQList(compQ);
    if (qList.length === 0) { skippedNoQ++; continue; }

    // First cited Q for which we have canonical text
    let firstQ = null;
    let firstQData = null;
    for (const q of qList) {
      const data = loadCanonical(q);
      if (data) { firstQ = q; firstQData = data; break; }
      missingQs.add(q);
    }
    if (!firstQData) { skippedNoCanonical++; continue; }

    const rest = qList.filter(q => q !== firstQ);
    const newBlock = buildSynthesis(firstQ, firstQData, rest);
    const updated = replaceSynthesisBlock(original, newBlock);
    if (updated === null) { skippedNoSynthesis++; continue; }
    if (updated === original) continue;

    filesChanged++;
    console.log(`  ${path.relative(ROOT, fpath)} ← Q${firstQ}`);
    if (!DRY_RUN) fs.writeFileSync(fpath, updated);
  }

  console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}files scanned: ${filesScanned} (teaching + concept)`);
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}files changed: ${filesChanged}`);
  console.log(`skipped (no compendium_q in frontmatter): ${skippedNoQ}`);
  console.log(`skipped (no ## Synthesis section): ${skippedNoSynthesis}`);
  console.log(`skipped (no canonical Q available — e.g. Q417 only): ${skippedNoCanonical}`);
  if (missingQs.size) {
    console.log(`Q numbers referenced but missing in raw/catechism-digital/: ${[...missingQs].sort((a, b) => a - b).join(', ')}`);
  }
}

main();
