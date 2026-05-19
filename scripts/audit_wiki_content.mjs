#!/usr/bin/env node
// Local content audit. Sweeps every wiki/ page and flags content that may need
// review BEFORE another deploy. Focused on the kinds of problems the Q360 case
// surfaced: OCR-corrupted Amharic in Q-blocks, truncated answers, missing
// canonical text, English content where Amharic is expected.
//
// Designed to be run locally — fast, no DB access, just file reads.
//
// Output: a structured report grouped by severity.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WIKI_DIR = path.join(ROOT, 'wiki');
const DIGITAL_DIR = path.join(ROOT, 'raw/catechism-digital');

// Load every canonical Q&A into memory once
const canonical = new Map();
for (const f of fs.readdirSync(DIGITAL_DIR)) {
  const m = f.match(/^Q(\d{3})\.md$/);
  if (!m) continue;
  const md = fs.readFileSync(path.join(DIGITAL_DIR, f), 'utf8');
  const qM = md.match(/## Question\s*\n([\s\S]*?)\n## Answer\s*\n([\s\S]*)$/);
  if (!qM) continue;
  const question = qM[1].trim().replace(/\s+/g, ' ');
  const answer = qM[2].trim().split(/\n{2,}/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
  canonical.set(parseInt(m[1], 10), { question, answer });
}

async function* walk(dir) {
  for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith('.md')) yield full;
  }
}

// Amharic codepoint ratio in a string (Ge'ez block U+1200..U+137F)
function amharicRatio(s) {
  if (!s) return 0;
  let am = 0, total = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x21 && cp <= 0x10FFFF && !/\s/.test(ch)) total++;
    if (cp >= 0x1200 && cp <= 0x137F) am++;
  }
  return total === 0 ? 0 : am / total;
}

const BLOCK_RE = /^### Q(\d+)\b[^\n]*\n+\*\*Q:\*\*\s*([^\n]*)\n+\*\*A:\*\*\s*([\s\S]*?)(?=\n\[CCC|\n### Q\d+|\n## |$)/gm;

const findings = {
  critical: [],   // Q-block doesn't match canonical (post-sync this should be empty)
  major: [],      // Truncated answer (much shorter than canonical), or empty
  warning: [],    // English-heavy text where Amharic expected
  info: [],       // Skipped (e.g. Q417 absent in source)
};

async function main() {
  let filesScanned = 0;
  let blocksScanned = 0;

  for await (const fpath of walk(WIKI_DIR)) {
    filesScanned++;
    const content = fs.readFileSync(fpath, 'utf8');
    const rel = path.relative(ROOT, fpath);

    let m;
    while ((m = BLOCK_RE.exec(content)) !== null) {
      blocksScanned++;
      const qNum = parseInt(m[1], 10);
      const qText = m[2].trim();
      const aText = m[3].trim();
      const ref = canonical.get(qNum);

      if (!ref) {
        if (qNum !== 417) findings.info.push(`${rel} Q${qNum} — no canonical (unexpected)`);
        continue;
      }

      if (!aText || aText.length < 20) {
        findings.major.push(`${rel} Q${qNum} — empty/very-short answer (${aText.length} chars)`);
        continue;
      }

      if (qText !== ref.question) {
        findings.critical.push(`${rel} Q${qNum} — question mismatch\n   wiki: ${qText.slice(0, 80)}\n   ref:  ${ref.question.slice(0, 80)}`);
      }

      if (aText !== ref.answer) {
        const lenRatio = aText.length / ref.answer.length;
        if (lenRatio < 0.5) {
          findings.major.push(`${rel} Q${qNum} — answer is ${Math.round(lenRatio * 100)}% of canonical length (${aText.length} vs ${ref.answer.length})`);
        } else if (lenRatio < 0.95) {
          findings.warning.push(`${rel} Q${qNum} — answer differs from canonical (${Math.round(lenRatio * 100)}% length)`);
        } else {
          // length matches but content differs → real diff
          findings.critical.push(`${rel} Q${qNum} — answer text mismatch (lengths match, content differs)`);
        }
      }

      // English-heavy content in an A-block (Amharic content expected)
      const ratio = amharicRatio(aText);
      if (ratio < 0.3 && aText.length > 30) {
        findings.warning.push(`${rel} Q${qNum} — answer only ${Math.round(ratio * 100)}% Amharic codepoints`);
      }
    }
  }

  const print = (label, list) => {
    if (!list.length) return;
    console.log(`\n━━━ ${label} (${list.length}) ━━━`);
    for (const item of list.slice(0, 30)) console.log('  • ' + item);
    if (list.length > 30) console.log(`  … and ${list.length - 30} more`);
  };

  console.log(`Files scanned: ${filesScanned}`);
  console.log(`Q-blocks scanned: ${blocksScanned}`);
  console.log(`Canonical Q&As loaded: ${canonical.size}`);

  print('CRITICAL — content mismatch with canonical', findings.critical);
  print('MAJOR — truncated / empty answers', findings.major);
  print('WARNING — partial content / English-heavy', findings.warning);
  print('INFO', findings.info);

  console.log(`\nTotals: critical=${findings.critical.length} major=${findings.major.length} warning=${findings.warning.length} info=${findings.info.length}`);
  if (findings.critical.length === 0 && findings.major.length === 0) {
    console.log('\n✓ No blocking issues. Q-blocks are aligned with canonical text.');
  } else {
    console.log('\n✗ Issues found. Review above before deploying.');
  }
}

main();
