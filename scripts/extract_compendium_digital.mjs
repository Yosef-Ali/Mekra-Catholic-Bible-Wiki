#!/usr/bin/env node
// Extract the Amharic Compendium of the CCC (digital edition) into one markdown
// file per Q&A — Karpathy-style RAG units.
//
// Input  : raw/catechism-digital/_source.txt  (pdftotext output from the
//          Pages.app export of raw/books/Compendium OF THE CATECHISM OF THE
//          CATHOLIC CHURCH.pages)
// Output : raw/catechism-digital/Q001.md … Q598.md
//
// Regenerating _source.txt from the .pages source (one-time, requires macOS):
//   osascript -e 'tell application "Pages" to export (open POSIX file \
//     "raw/books/Compendium OF THE CATECHISM OF THE CATHOLIC CHURCH.pages") \
//     to POSIX file "/tmp/compendium.pdf" as PDF'
//   pdftotext /tmp/compendium.pdf raw/catechism-digital/_source.txt

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'raw/catechism-digital/_source.txt');
const OUT_DIR = path.join(ROOT, 'raw/catechism-digital');
const SOURCE_REF = 'raw/books/Compendium OF THE CATECHISM OF THE CATHOLIC CHURCH.pages';
const MAX_Q = 598;

const ORD = {
  'አንድ': 1, 'ሁለት': 2, 'ሶስት': 3, 'ሦስት': 3, 'አራት': 4,
  'አምስት': 5, 'ስድስት': 6, 'ሰባት': 7, 'ስምንት': 8, 'ዘጠኝ': 9, 'አስር': 10,
};
const ORD_RE = Object.keys(ORD).join('|');

// Some PDF lines use letter-spacing for emphasis (e.g. "6 6 . ወ ን ድ ና ሴ ት …").
// pdftotext flattens to uniform single spaces, so we can't recover word breaks
// — collapse the whole line so downstream regexes work. Heuristic: line has 5+
// tokens and >75% of tokens are exactly one codepoint.
function isLetterSpaced(line) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 5) return false;
  const singles = tokens.filter(t => [...t].length === 1).length;
  return singles / tokens.length > 0.75;
}

function collapseLetterSpacing(line) {
  return line.replace(/\s+/g, '');
}

function detectHeader(line) {
  const t = line.trim();
  if (new RegExp(`^ክፍል\\s+(${ORD_RE})\\s*$`).test(t)) return { type: 'part', label: t };
  if (new RegExp(`^ንኡስ\\s+ክፍል\\s+(${ORD_RE})`).test(t)) return { type: 'subsection', label: t };
  if (new RegExp(`^ምዕራፍ\\s+(${ORD_RE})\\s*$`).test(t)) return { type: 'chapter', label: t };
  return null;
}

// A line that's just a CCC paragraph reference (range, or a single number >MAX_Q
// since Q-numbers max at 598). Used to detect the end of a question that lacks `?`.
function looksLikeCccRefLine(t) {
  if (/^\d{1,4}-\d{1,4}\.?\s*$/.test(t)) return true;
  const m = t.match(/^(\d{1,4})\.?\s*$/);
  if (m && parseInt(m[1]) > MAX_Q) return true;
  return false;
}

// A line that starts another Q (M. <text>) where M ≤ MAX_Q and M ≠ expectedQ.
function looksLikeOtherQStart(t, expectedQ) {
  const m = t.match(/^(\d+)\s*\.\s*/);
  if (!m) return false;
  const n = parseInt(m[1]);
  return n >= 1 && n <= MAX_Q && n !== expectedQ;
}

// Try to read a question starting at lines[idx] expecting Q-number = expectedQ.
// The PDF emits several formats:
//   (a) "24. <question text…?>"      — Q + text on same line, ends with `?`
//   (b) "24.\n\n<text>\n…\n…?"        — Q-number alone, text follows after blank(s)
//   (c) "376. <question text>\n1794." — Q has no `?`; CCC ref line marks the end
// Walks up to 8 lines forward, skipping blank lines, gathering until `?` OR a CCC
// ref appears. Bails if another Q-number or a section header interrupts.
function tryParseQuestion(lines, idx, expectedQ) {
  const head = lines[idx].match(new RegExp(`^${expectedQ}\\.\\s*(.*)$`));
  if (!head) return null;
  let qText = head[1].trim();
  if (qText && /\?\s*$/.test(qText)) return { question: qText, endIdx: idx };

  for (let j = 1; j <= 8 && idx + j < lines.length; j++) {
    const raw = lines[idx + j];
    const next = raw.trim();
    if (!next) continue;
    if (detectHeader(raw)) return null;
    if (looksLikeCccRefLine(next)) {
      if (!qText) return null;
      return { question: qText, endIdx: idx + j - 1 };   // question ended just before this CCC ref
    }
    if (looksLikeOtherQStart(next, expectedQ)) return null;
    qText = (qText + ' ' + next).trim();
    if (/\?\s*$/.test(next)) return { question: qText, endIdx: idx + j };
  }
  return null;
}

// Strip leading CCC range refs (e.g. "31-36 ", "44-45 27-30 ") from a line.
function stripCccPrefix(line) {
  const ccc = [];
  let s = line.replace(/^\s+/, '');
  while (true) {
    const m = s.match(/^(\d{1,4}-\d{1,4})\s*(.*)$/);
    if (!m) break;
    ccc.push(m[1]);
    s = m[2];
  }
  return { ccc, rest: s };
}

// CCC marginalia lines in the answer body. Covers: single number (`469`),
// number with trailing period (`469.`, `1794.`), range (`479-481`), and
// multiple space-separated ranges. Also matches stray page-number footers.
function isStandaloneCccOrFooter(line) {
  const t = line.trim();
  if (/^\d{1,4}\.?$/.test(t)) return true;
  if (/^\d{1,4}-\d{1,4}\.?$/.test(t)) return true;
  if (/^\d{1,4}-\d{1,4}(\s+\d{1,4}-\d{1,4})+\.?\s*$/.test(t)) return true;
  return false;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing source text: ${SRC}`);
    console.error('See script header for regen instructions.');
    process.exit(1);
  }

  // pdftotext emits \f at page boundaries — strip so it doesn't break ^N\. matching.
  // Also pre-collapse letter-spaced lines (PDF emphasis layout) so all regexes work uniformly.
  const lines = fs.readFileSync(SRC, 'utf8')
    .replace(/\f/g, '')
    .split('\n')
    .map(l => isLetterSpaced(l) ? collapseLetterSpacing(l) : l);

  // Pass 1a: collect ALL candidate Q-lines along with their section context.
  // A candidate is any line `^N. …` where N ∈ [1, MAX_Q] and tryParseQuestion
  // can extract a complete question (ends with `?` or terminated by a CCC ref).
  // We also snapshot the running section state at each candidate.
  const candidates = [];
  const state = { part: null, subsection: null, chapter: null };
  for (let i = 0; i < lines.length; i++) {
    const h = detectHeader(lines[i]);
    if (h) {
      if (h.type === 'part') { state.part = h.label; state.subsection = null; state.chapter = null; }
      else if (h.type === 'subsection') { state.subsection = h.label; state.chapter = null; }
      else { state.chapter = h.label; }
      continue;
    }
    const m = lines[i].match(/^(\d{1,3})\s*\.\s*(.*)$/);
    if (!m) continue;
    const n = parseInt(m[1]);
    if (n < 1 || n > MAX_Q) continue;
    const r = tryParseQuestion(lines, i, n);
    if (!r) continue;
    candidates.push({
      q: n,
      startIdx: i,
      endIdxOfQuestion: r.endIdx,
      question: r.question,
      state: { ...state },
    });
  }

  // Pass 1b: pick the monotonically-increasing Q subsequence with a bounded jump.
  // Greedy + MAX_GAP. Without MAX_GAP, CCC refs like "469." that appear inside an
  // answer body (and look syntactically like a Q-line) would be accepted as Q469
  // and then shadow real Q90…Q468. Bounding the jump to lastQ+MAX_GAP rejects those
  // far-ahead candidates while still permitting genuine gaps (e.g. Q417 missing).
  const MAX_GAP = 15;
  const qIndex = [];
  let lastQ = 0;
  for (const c of candidates) {
    if (c.q > lastQ && c.q <= lastQ + MAX_GAP) {
      qIndex.push(c);
      lastQ = c.q;
    }
  }

  // Track candidates that were *rejected* by the monotonic picker. These are the
  // chapter-subtitle lines like "1. ሰው እግዚአብሔርን ለመቀበል ያለው ችሎታ" — Q-shaped
  // but appearing after their qNum has already been claimed. Their line spans get
  // stripped from answer bodies in pass 2.
  const acceptedStarts = new Set(qIndex.map(c => c.startIdx));
  const rejectedLines = new Set();
  for (const c of candidates) {
    if (acceptedStarts.has(c.startIdx)) continue;
    for (let i = c.startIdx; i <= c.endIdxOfQuestion; i++) rejectedLines.add(i);
  }

  const seenQs = new Set(qIndex.map(c => c.q));
  const missingQs = [];
  for (let q = 1; q <= MAX_Q; q++) {
    if (!seenQs.has(q)) missingQs.push(q);
  }
  console.log(`Extracted ${qIndex.length} / ${MAX_Q} Q's; gaps: ${missingQs.length ? missingQs.join(', ') : 'none'}`);

  // Pass 2: per Q, slice answer = (endIdxOfQuestion+1 .. nextQ.startIdx-1).
  // Clean stale Q*.md files from prior runs first so the output reflects only
  // this extraction.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^Q\d{3}\.md$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  }
  let written = 0;

  for (let qi = 0; qi < qIndex.length; qi++) {
    const cur = qIndex[qi];
    const next = qIndex[qi + 1];
    // For the final Q (no next), cap answer at 30 lines so we don't swallow the
    // post-Q598 appendix (common prayers, catechism formulas, beatitudes, etc.).
    const ansEnd = next ? next.startIdx : Math.min(cur.endIdxOfQuestion + 30, lines.length);
    const ansStart = cur.endIdxOfQuestion + 1;

    const ccc = [];
    const bodyLines = [];
    for (let li = ansStart; li < ansEnd; li++) {
      const ln = lines[li];
      if (rejectedLines.has(li)) continue;               // strip chapter-subtitle false-positives
      if (detectHeader(ln)) continue;                    // strip section heads
      if (isStandaloneCccOrFooter(ln)) {
        const t = ln.trim().replace(/\.$/, '');
        t.split(/\s+/).forEach(r => { if (/\d/.test(r)) ccc.push(r); });
        continue;
      }
      const { ccc: pref, rest } = stripCccPrefix(ln);
      pref.forEach(r => ccc.push(r));
      bodyLines.push(pref.length ? rest : ln);
    }

    // Collapse: join continuation lines within a paragraph, preserve blank-line breaks.
    const paragraphs = [];
    let buf = [];
    for (const ln of bodyLines) {
      if (ln.trim() === '') {
        if (buf.length) { paragraphs.push(buf.join(' ').replace(/\s+/g, ' ').trim()); buf = []; }
      } else {
        buf.push(ln.trim());
      }
    }
    if (buf.length) paragraphs.push(buf.join(' ').replace(/\s+/g, ' ').trim());
    const answer = paragraphs.filter(p => p).join('\n\n');

    const cccUniq = [...new Set(ccc)];
    const id = String(cur.q).padStart(3, '0');
    const fpath = path.join(OUT_DIR, `Q${id}.md`);

    const md = `# Q${cur.q} — ${cur.question}

**Type:** compendium-qa
**Q:** ${cur.q}
**Part:** ${cur.state.part || '—'}
**Subsection:** ${cur.state.subsection || '—'}
**Chapter:** ${cur.state.chapter || '—'}
**CCC:** ${cccUniq.length ? cccUniq.join(', ') : '—'}
**Source:** ${SOURCE_REF}

## Question
${cur.question}

## Answer
${answer || '[empty — verify in source]'}
`;
    fs.writeFileSync(fpath, md);
    written++;
  }

  console.log(`Wrote ${written} Q&A files to ${path.relative(ROOT, OUT_DIR)}/`);
}

main();
