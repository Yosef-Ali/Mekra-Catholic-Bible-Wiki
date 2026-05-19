#!/usr/bin/env node
// Extract the *non-Q&A* material from the Amharic Compendium of the CCC:
// the front matter (title, copyright, ToC, Pope's preface) and the back
// matter (angels coda, common prayers, catechism formulas, Amharic index,
// final papal words). This is the same `.pages` source that
// extract_compendium_digital.mjs uses; the two scripts produce complementary
// outputs in `raw/catechism-digital/`.
//
// Output:
//   raw/catechism-digital/intro.md
//   raw/catechism-digital/appendix.md
//
// Each file is one Karpathy-style file with `## ` headings inside that
// downstream RAG chunkers can split on.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'raw/catechism-digital/_source.txt');
const OUT_DIR = path.join(ROOT, 'raw/catechism-digital');
const SOURCE_REF = 'raw/books/Compendium OF THE CATECHISM OF THE CATHOLIC CHURCH.pages';

function isLetterSpaced(line) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 5) return false;
  const singles = tokens.filter(t => [...t].length === 1).length;
  return singles / tokens.length > 0.75;
}

function loadLines() {
  return fs.readFileSync(SRC, 'utf8')
    .replace(/\f/g, '')
    .split('\n')
    .map(l => isLetterSpaced(l) ? l.replace(/\s+/g, '') : l);
}

function findLine(lines, re, from = 0) {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i;
  return -1;
}

// Page-number footer: standalone arabic 1-3 digit, or roman lower-case (i, ii, …).
function isPageFooter(line) {
  const t = line.trim();
  return /^\d{1,3}$/.test(t) || /^[ivxlcdm]{1,6}$/.test(t);
}

// Body Q1 is the first `^1\. … ?` line. Lines before that constitute the intro.
function findBodyStart(lines) {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^1\.\s*(.*)$/);
    if (!m) continue;
    let q = m[1].trim();
    if (/\?\s*$/.test(q)) return i;
    for (let j = 1; j <= 5 && i + j < lines.length; j++) {
      const nx = lines[i + j].trim();
      if (!nx) continue;
      if (/^\d+\./.test(nx)) break;
      q += ' ' + nx;
      if (/\?\s*$/.test(nx)) return i;
    }
  }
  return -1;
}

// Convert a line range into clean markdown body text:
//   - drop standalone page-number footers
//   - drop the section's own header line (we add it as H2 ourselves)
//   - join continuation lines into paragraphs; blank lines = paragraph break
function renderSection(lines, from, to, opts = {}) {
  const headerLine = (opts.header ?? '').trim();
  const out = [];
  let buf = [];
  const flush = () => {
    if (buf.length) {
      out.push(buf.join(' ').replace(/\s+/g, ' ').trim());
      buf = [];
    }
  };
  for (let i = from; i < to; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) { flush(); continue; }
    if (isPageFooter(t)) continue;
    if (headerLine && t === headerLine) continue;
    buf.push(t);
  }
  flush();
  return out.filter(p => p).join('\n\n');
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}`);
    process.exit(1);
  }
  const lines = loadLines();

  // ── Boundaries ────────────────────────────────────────────────────────────
  const bodyStart = findBodyStart(lines);
  if (bodyStart < 0) { console.error('Could not find body Q1'); process.exit(1); }

  // The title page runs until the first "i" page indicator (roman front-matter pagination).
  const tocStart = findLine(lines, /^\s*i\s*$/);
  // The Pope's preface starts with `1. ርእሰ ሊቃነ ጳጳሳት …`. Back up from there to the
  // "መግቢያ" header line. We can't search for "መግቢያ" forward because it also appears
  // as a ToC entry well before the real preface header.
  const popeItem1 = findLine(lines, /^1\.\s+ርእሰ ሊቃነ ጳጳሳት/, tocStart);
  let prefaceHeader = -1;
  for (let i = popeItem1 - 1; i >= 0 && popeItem1 > 0; i--) {
    if (/^መግቢያ\s*$/.test(lines[i])) { prefaceHeader = i; break; }
  }

  // Appendix anchors. The Cyril-of-Jerusalem quote closes the final Q598 answer;
  // the line after it is where the angels coda begins.
  const APPENDIX_RAW_START = findLine(lines, /^598\./);
  const cyrilEnd = findLine(lines, /ቄርሎስ ዘኢየሩሳሌም\)/, APPENDIX_RAW_START);
  const angelsStart = cyrilEnd + 1;
  const tedjemariMarker = findLine(lines, /^ተጨማሪ መግለጫ\s*$/, angelsStart);
  const prayersHeader = findLine(lines, /^ሀ\) መደበኛ ጸሎቶች/, tedjemariMarker);
  const formulasHeader = findLine(lines, /^ለ\) የካቶሊክ ትምህርተ ሃይማኖት/, prayersHeader);
  const indexHeader = findLine(lines, /^የቃላት ማውጫ\s*$/, formulasHeader);
  const finalHeader = findLine(lines, /^ይህ በአጭር ማብራሪያ/, indexHeader);

  const anchors = { tocStart, prefaceHeader, angelsStart, tedjemariMarker, prayersHeader, formulasHeader, indexHeader, finalHeader };
  if (Object.values(anchors).some(n => n < 0)) {
    console.error('One or more anchors not found:', anchors);
    process.exit(1);
  }

  // ── intro.md ──────────────────────────────────────────────────────────────
  const introSections = [
    ['Title Page (የሽፋን ገጽ)', renderSection(lines, 0, tocStart)],
    ['Table of Contents (ማውጫ)', renderSection(lines, tocStart, prefaceHeader, { header: 'ማውጫ' })],
    ["Pope John Paul II — Motu Proprio (መግቢያ)", renderSection(lines, prefaceHeader, bodyStart, { header: 'መግቢያ' })],
  ];

  const introMd = `# Intro — የካቶሊክ ቤተክርስቲያን ትምህርተ ክርስቶስ በአጭሩ

**Type:** compendium-intro
**Source:** ${SOURCE_REF}
**Sections:** ${introSections.length}

` + introSections.map(([h, body]) => `## ${h}\n\n${body}`).join('\n\n');

  fs.writeFileSync(path.join(OUT_DIR, 'intro.md'), introMd + '\n');

  // ── appendix.md ──────────────────────────────────────────────────────────
  const appendixSections = [
    ['Angels — የመላእክት መታሰቢያ', renderSection(lines, angelsStart, tedjemariMarker)],
    ['Common Prayers — ሀ) መደበኛ ጸሎቶች', renderSection(lines, prayersHeader, formulasHeader, { header: 'ሀ) መደበኛ ጸሎቶች' })],
    ['Catechism Formulas — ለ) የካቶሊክ ትምህርተ ሃይማኖት ሥርዓት', renderSection(lines, formulasHeader, indexHeader, { header: 'ለ) የካቶሊክ ትምህርተ ሃይማኖት ሥርዓት' })],
    ['Amharic Index — የቃላት ማውጫ', renderSection(lines, indexHeader, finalHeader, { header: 'የቃላት ማውጫ' })],
    ['Final Words — ጳጳስ ቤኔድክቶስ 16ኛ', renderSection(lines, finalHeader, lines.length)],
  ];

  const appendixMd = `# Appendix — የካቶሊክ ቤተክርስቲያን ትምህርተ ክርስቶስ በአጭሩ

**Type:** compendium-appendix
**Source:** ${SOURCE_REF}
**Sections:** ${appendixSections.length}

` + appendixSections.map(([h, body]) => `## ${h}\n\n${body}`).join('\n\n');

  fs.writeFileSync(path.join(OUT_DIR, 'appendix.md'), appendixMd + '\n');

  console.log(`Wrote intro.md (${introSections.length} sections) and appendix.md (${appendixSections.length} sections)`);
  console.log(`Anchors: tocStart=${tocStart}, prefaceHeader=${prefaceHeader}, bodyStart=${bodyStart},`);
  console.log(`  angelsStart=${angelsStart}, prayersHeader=${prayersHeader}, formulasHeader=${formulasHeader},`);
  console.log(`  indexHeader=${indexHeader}, finalHeader=${finalHeader}`);
}

main();
