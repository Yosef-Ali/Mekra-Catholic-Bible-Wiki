#!/usr/bin/env node
// Replace embedded `### QNNN` Q&A blocks in every wiki/ page with the canonical
// Amharic text from `raw/catechism-digital/QNNN.md`. The wiki was originally
// seeded from OCR'd scans (`raw/catechism/extracted/`); the canonical text now
// lives in `raw/catechism-digital/` (extracted from the publisher's `.pages`
// file). This script brings every wiki Q-block back into alignment with the
// canonical source.
//
// Block format the script reads + writes:
//   ### Q<NNN>
//
//   **Q:** <question text>
//
//   **A:** <answer text — paragraphs joined with markdown line breaks>
//
//   [CCC <ranges>]
//
// Lines surrounding the block are preserved as-is. Idempotent — running it
// repeatedly produces no further changes once everything is aligned.
//
// Usage:
//   node scripts/sync_qa_blocks_from_digital.mjs              # apply changes
//   node scripts/sync_qa_blocks_from_digital.mjs --dry-run    # report only

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIKI_DIR = path.join(ROOT, 'wiki');
const DIGITAL_DIR = path.join(ROOT, 'raw/catechism-digital');
const DRY_RUN = process.argv.includes('--dry-run');

// Parse one canonical QNNN.md → { question, answer, ccc }
function loadCanonical(qNum) {
  const id = String(qNum).padStart(3, '0');
  const fpath = path.join(DIGITAL_DIR, `Q${id}.md`);
  if (!fs.existsSync(fpath)) return null;
  const md = fs.readFileSync(fpath, 'utf8');

  const cccM = md.match(/^\*\*CCC:\*\*\s*(.+)$/m);
  const ccc = cccM ? cccM[1].trim() : '';

  // Capture Question section (up to "## Answer") and Answer section (to end of file).
  // The /m flag is omitted so `$` means end-of-string, not end-of-line.
  const qM = md.match(/## Question\s*\n([\s\S]*?)\n## Answer\s*\n([\s\S]*)$/);
  if (!qM) return null;

  const question = qM[1].trim().replace(/\s+/g, ' ');
  // Collapse the answer paragraphs into a single line of markdown.
  // (The wiki Q-block convention is one paragraph per A: line — matches the
  // existing pages and the WikiViewer renderer.)
  const answer = qM[2].trim()
    .split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');

  return { question, answer, ccc };
}

// Walk wiki/ for .md files
async function* walk(dir) {
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith('.md')) yield full;
  }
}

// Replace one Q-block. Captures up to (but not including) the next `### Q###`
// or `## ` heading, OR end of file.
function rebuildBlock(qNum, canonical) {
  const cccLine = canonical.ccc && canonical.ccc !== '—' ? `\n\n[CCC ${canonical.ccc}]` : '';
  return `### Q${qNum}\n\n**Q:** ${canonical.question}\n\n**A:** ${canonical.answer}${cccLine}\n`;
}

const Q_BLOCK_RE = /^### Q(\d+)\b[^\n]*\n[\s\S]*?(?=^### Q\d+|^## |\Z)/gm;

async function main() {
  let filesScanned = 0;
  let filesChanged = 0;
  let blocksReplaced = 0;
  let blocksSkipped = 0;
  const missing = new Set();

  for await (const fpath of walk(WIKI_DIR)) {
    filesScanned++;
    const original = fs.readFileSync(fpath, 'utf8');
    let changed = false;

    const updated = original.replace(Q_BLOCK_RE, (match, qStr) => {
      const qNum = parseInt(qStr, 10);
      const canonical = loadCanonical(qNum);
      if (!canonical) {
        missing.add(qNum);
        blocksSkipped++;
        return match;
      }
      const fresh = rebuildBlock(qNum, canonical);
      // Preserve trailing whitespace pattern (most blocks end with \n\n then next heading).
      const trailingNL = match.match(/\n+$/)?.[0] ?? '\n';
      const newBlock = fresh.replace(/\n$/, '') + trailingNL;
      if (newBlock !== match) {
        blocksReplaced++;
        changed = true;
      }
      return newBlock;
    });

    if (changed) {
      filesChanged++;
      if (!DRY_RUN) fs.writeFileSync(fpath, updated);
      console.log(`  ${path.relative(ROOT, fpath)}`);
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}files scanned: ${filesScanned}`);
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}files changed: ${filesChanged}`);
  console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Q-blocks replaced: ${blocksReplaced}`);
  console.log(`Q-blocks skipped (no canonical): ${blocksSkipped}`);
  if (missing.size) {
    console.log(`Missing Q numbers in raw/catechism-digital/: ${[...missing].sort((a, b) => a - b).join(', ')}`);
  }
}

main();
