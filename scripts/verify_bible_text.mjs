#!/usr/bin/env node
/**
 * verify_bible_text.mjs — verify the Neon DB Bible text against the
 * Emmaus PDF's embedded text layer (ground truth).
 *
 * The Emmaus PDF ("The Amharic Bible Catholic Edition - Emmaus.pdf") carries
 * a real digital text layer (typeset, not scanned), so `pdftotext` recovers
 * the publisher's exact text. The DB text came from a Gemini-vision
 * extraction pipeline and contains word-level corruptions (dropped words,
 * fidel-order swaps, verb substitutions, ፥→፤ punctuation drift). This script
 * finds them mechanically: verse-aligned word diff, PDF vs DB.
 *
 * Usage:
 *   node scripts/verify_bible_text.mjs Leviticus            # one book
 *   node scripts/verify_bible_text.mjs Leviticus 1          # one chapter
 *   node scripts/verify_bible_text.mjs --all                # all 73 books
 *   node scripts/verify_bible_text.mjs --all --out report.md
 *
 * Options:
 *   --out <file>   write the markdown report to a file (default stdout)
 *   --punct        include punctuation-only diffs in the detail table
 *
 * Classes reported (most→least severe):
 *   verse-missing   verse exists in PDF but not DB (or vice versa)
 *   db-extra        word(s) in DB not in PDF — insertions/duplications
 *   db-missing      word(s) in PDF dropped from DB
 *   word            whole-word substitution (different lexeme)
 *   char(N)         same word corrupted in N fidel positions (order swaps etc.)
 *   heading?        PDF-only tokens at a verse end — likely a section heading
 *   dup             consecutive duplicated word inside DB text
 *   punct           tokens equal except Ethiopic punctuation (e.g. ፥ vs ፤)
 *
 * Read-only with respect to the DB (SELECT only). Never writes to the app.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const APP_DIR = '/Users/mekdesyared/Mekra-Catholic-Bible';
const PDF = `${APP_DIR}/The Amharic Bible Catholic Edition - Emmaus.pdf`;
const PAGE_MAP = `${APP_DIR}/extraction_output/page_map.json`;

// ---------- env ----------
const APP_ENV = `${APP_DIR}/.env`;
if (!process.env.DATABASE_URL && existsSync(APP_ENV)) {
  for (const line of readFileSync(APP_ENV, 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) { process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, ''); break; }
  }
}
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found'); process.exit(2);
}
const sql = neon(process.env.DATABASE_URL);

// ---------- args ----------
const args = process.argv.slice(2);
const showPunct = args.includes('--punct');
let outFile = null;
const oi = args.indexOf('--out');
if (oi !== -1) { outFile = args[oi + 1]; args.splice(oi, 2); }
const positional = args.filter(a => !a.startsWith('--'));
const allMode = args.includes('--all');
if (!allMode && positional.length === 0) {
  console.error('Usage: node scripts/verify_bible_text.mjs <book> [chapter] | --all  [--out f.md] [--punct]');
  process.exit(1);
}
const [bookArg, chapterArg] = positional;
const onlyChapter = chapterArg ? parseInt(chapterArg, 10) : null;

// ---------- page map ----------
function* findBooks(o) {
  if (Array.isArray(o)) { for (const v of o) yield* findBooks(v); }
  else if (o && typeof o === 'object') {
    if ('start_page' in o && 'amharic' in o) yield o;
    else for (const v of Object.values(o)) yield* findBooks(v);
  }
}
const pageBooks = [...findBooks(JSON.parse(readFileSync(PAGE_MAP, 'utf8')))];

// ---------- text utilities ----------
const INVISIBLES = /[⁠​﻿­]/g;
const QUOTES = /[«»“”‘’"']/g;
const ETH_PUNCT = /[።፤፥፣፦፡!?.,;:()\[\]…—–-]/g;

function normalize(s) {
  return s.replace(INVISIBLES, '').replace(/‑/g, '-').replace(/\s+/g, ' ').trim();
}
function tokenKey(tok) {
  // comparison key: strip quotes + punctuation
  return tok.replace(QUOTES, '').replace(ETH_PUNCT, '');
}
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 4) return 99;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// LCS-based token diff → hunks {type: 'eq'|'sub'|'del'|'ins', a:[], b:[]}
// a = PDF tokens, b = DB tokens (compared on tokenKey)
function diffTokens(a, b) {
  const ka = a.map(tokenKey), kb = b.map(tokenKey);
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = ka[i] === kb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hunks = [];
  let i = 0, j = 0;
  const push = (type, ta, tb) => {
    const last = hunks[hunks.length - 1];
    if (last && last.type === type) { last.a.push(...ta); last.b.push(...tb); }
    else hunks.push({ type, a: [...ta], b: [...tb] });
  };
  while (i < m && j < n) {
    if (ka[i] === kb[j]) { push('eq', [a[i]], [b[j]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push('del', [a[i]], []); i++; }
    else { push('ins', [], [b[j]]); j++; }
  }
  while (i < m) { push('del', [a[i]], []); i++; }
  while (j < n) { push('ins', [], [b[j]]); j++; }
  // merge adjacent del+ins into sub
  const merged = [];
  for (const h of hunks) {
    const last = merged[merged.length - 1];
    if (last && ((last.type === 'del' && h.type === 'ins') || (last.type === 'ins' && h.type === 'del'))) {
      merged[merged.length - 1] = { type: 'sub', a: last.a.concat(h.a), b: last.b.concat(h.b) };
    } else merged.push(h);
  }
  return merged;
}

// ---------- PDF side ----------
// Neither pdftotext mode is right for every book: -raw follows the content
// stream (jumbled on Isaiah/Psalms two-column pages), default layout mode
// interleaves the columns on Leviticus-style pages. Extract with BOTH and
// let the caller keep, per chapter, whichever parse yields more verses.
function pdfTextForBook(pb, nextStart) {
  const runPages = (extra, f, l) => execFileSync('pdftotext',
    ['-f', String(f), '-l', String(l), ...extra, '-enc', 'UTF-8', PDF, '-'],
    { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  // boundary page (next book's first page) extracted separately so chapter
  // selection can distinguish our chapters from the next book's
  const last = nextStart ? Math.min(pb.end_page + 1, nextStart) : pb.end_page + 1;
  const tryBdy = extra => {
    if (last <= pb.end_page) return '';
    try { return runPages(extra, pb.end_page + 1, last); }
    catch { return ''; }                 // last book: end_page+1 is past EOF
  };
  const mk = extra => ({
    main: runPages(extra, pb.start_page, pb.end_page),
    bdy: tryBdy(extra),
  });
  return { raw: mk(['-raw']), layout: mk([]) };
}

function cleanPdfLines(text, amharicTitle) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\d+$/.test(line)) continue;                                  // page number
    if (/^\d+፥\d+/.test(line)) continue;                               // apparatus (cross-refs)
    if (((line.match(/\d+፥\d+/g) || []).length) >= 2) continue;        // apparatus continuation
    if (/^\d{1,2}\.\s.*\(\d{1,3}[\u2011\u2013-]\d{1,3}\)\s*$/.test(line)) continue; // intro outline entry
    const norm = s => s.replace(INVISIBLES, '').replace(/[\d\u2011\u2013-]+/g, '').replace(/\s+/g, ' ').trim();
    const nl = norm(line), nt = amharicTitle ? norm(amharicTitle) : '';
    if (nt && nl.startsWith(nt) && nl.length <= nt.length + 8) continue; // running head (title + optional suffix like ሰዎች)
    out.push(line);
  }
  return out.join('\n');
}

// split a book's cleaned text into chapters, tolerant of the word ምዕራፍ/መዝሙር
// appearing in body text (only accept the marker when the number is sequential)
function splitChapters(text, expected, boundaryOffset = Infinity) {
  // [ \t] only: a marker must not straddle a line break — psalm
  // superscriptions end with the bare word መዝሙር and the next line
  // starts with the verse number, which must NOT read as a marker
  const re = /(ምዕራፍ|መዝሙር)[ \t]+(\d{1,3})/g;
  const all = [];
  let m;
  while ((m = re.exec(text)) !== null)
    all.push({ num: parseInt(m[2], 10), start: m.index, end: m.index + m[0].length });
  // single-chapter books print no ምዕራፍ heading of their own; any marker in
  // the extracted range belongs to the NEXT book
  if (expected === 1) {
    const cut = all[0]?.start ?? text.length;
    return new Map([[1, text.slice(0, cut)]]);
  }
  // Per-chapter independent marker selection: no global sequential chain.
  // A chapter's candidate text runs from its marker to the next marker of
  // any number; among duplicate markers (running heads, intro mentions,
  // stream scrambles) the one yielding the most sequential verses wins.
  const chapters = new Map();
  for (let n = 1; n <= expected; n++) {
    // markers on the boundary page may belong to the NEXT book: use them
    // only when no in-range candidate exists, and never for chapter 1
    const inRange = all.some(a => a.num === n && a.start < boundaryOffset);
    let best = null, bestScore = 0;
    for (let i = 0; i < all.length; i++) {
      if (all[i].num !== n) continue;
      if (all[i].start >= boundaryOffset && (inRange || n === 1)) continue;
      const to = i + 1 < all.length ? all[i + 1].start : text.length;
      const seg = text.slice(all[i].end, to);
      const score = splitVerses(seg).verses.size;
      if (score > bestScore) { bestScore = score; best = seg; }
    }
    if (best !== null) chapters.set(n, best);
  }
  return chapters;
}

// split chapter text into verses at arabic verse numbers (monotonic guard);
// text before verse 1 (headings/intro) is returned separately
function splitVerses(chText) {
  const re = /(\d{1,3})(?:[‑-](\d{1,3}))?(?!\d)/g;
  const verses = new Map();
  let m, cur = 0, lastIdx = null, preamble = null;
  const marks = [];
  while ((m = re.exec(chText)) !== null) {
    const n = parseInt(m[1], 10);
    if (n === cur + 1) {
      marks.push({ n, span: m[2] ? parseInt(m[2], 10) : n, start: m.index, end: m.index + m[0].length });
      cur = m[2] ? parseInt(m[2], 10) : n;
    }
    // non-sequential digits are left glued to the running verse text
  }
  for (let k = 0; k < marks.length; k++) {
    const from = marks[k].end;
    const to = k + 1 < marks.length ? marks[k + 1].start : chText.length;
    if (k === 0 && marks[k].start > 0) preamble = chText.slice(0, marks[k].start).trim();
    verses.set(marks[k].n, { text: chText.slice(from, to).trim(), span: marks[k].span });
  }
  return { verses, preamble };
}

// ---------- DB side ----------
function extractDbVerses(content) {
  const verses = [];
  const subtitles = [];
  (function walk(o) {
    if (!o) return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o !== 'object') return;
    if (typeof o.subtitle_text === 'string' && o.subtitle_text.trim()) subtitles.push(o.subtitle_text.trim());
    if (Array.isArray(o.verses)) {
      for (const v of o.verses) {
        const num = v.verse_number ?? v.verse ?? v.number;
        if (num != null && typeof v.text === 'string') verses.push({ num, text: v.text });
      }
    }
    if (Array.isArray(o.sections)) o.sections.forEach(walk);
    if (Array.isArray(o.content)) o.content.forEach(walk);
  })(content);
  return { verses, subtitles };
}

// ---------- verification ----------
async function verifyBook(book, pb, nextStart, findings, stats) {
  const chapterRows = await sql`
    SELECT chapter_number, content FROM formatted_chapter_contents
    WHERE book_id = ${book.id} ORDER BY chapter_number`;
  const texts = pdfTextForBook(pb, nextStart);
  const variants = ['raw', 'layout'].map(mode => {
    const keepLines = s => s.replace(INVISIBLES, '').replace(/‑/g, '-').replace(/[ \t]+/g, ' ').trim();
    const main = keepLines(cleanPdfLines(texts[mode].main, book.amharic_name));
    const bdy = keepLines(cleanPdfLines(texts[mode].bdy, book.amharic_name));
    return splitChapters(bdy ? main + '\n' + bdy : main, book.chapters, main.length);
  });

  for (const row of chapterRows) {
    const ch = row.chapter_number;
    if (onlyChapter && ch !== onlyChapter) continue;
    const { verses: dbVerses, subtitles } = extractDbVerses(row.content);
    const subtitleKeys = new Set(subtitles.flatMap(s => normalize(s).split(' ').map(tokenKey)));
    // per chapter, keep whichever extraction mode parsed more verses
    let pdfVerses = null;
    for (const chapters of variants) {
      const txt = chapters.get(ch);
      if (!txt) continue;
      const { verses } = splitVerses(txt);
      if (!pdfVerses || verses.size > pdfVerses.size) pdfVerses = verses;
    }
    if (!pdfVerses || pdfVerses.size === 0) { stats.chaptersUnparsed++; findings.push({ ref: `${book.name} ${ch}`, cls: 'chapter-unparsed', pdf: '—', db: `${dbVerses.length} verses in DB` }); continue; }
    stats.chaptersChecked++;

    const nums = new Set([...dbVerses.map(v => v.num), ...pdfVerses.keys()]);
    for (const n of [...nums].sort((a, b) => a - b)) {
      const dv = dbVerses.filter(v => v.num === n);
      const pv = pdfVerses.get(n);
      const inSpan = [...pdfVerses.values()].some(x => x.span > n && [...pdfVerses.keys()].some(k => k <= n && pdfVerses.get(k).span >= n));
      if (dv.length && !pv) {
        if (!inSpan) findings.push({ ref: `${book.name} ${ch}:${n}`, cls: 'verse-missing', pdf: '(not parsed from PDF)', db: dv[0].text.slice(0, 80) });
        continue;
      }
      if (!dv.length && pv) {
        findings.push({ ref: `${book.name} ${ch}:${n}`, cls: 'verse-missing', pdf: pv.text.slice(0, 80), db: '(absent in DB)' });
        continue;
      }
      if (!dv.length || !pv) continue;
      stats.versesChecked++;

      // merged-verse markers (e.g. 15‑16): concatenate the DB span
      let dbText = dv.map(v => v.text).join(' ');
      if (pv.span > n) {
        dbText = dbVerses.filter(v => v.num >= n && v.num <= pv.span).map(v => v.text).join(' ');
      }
      const aTok = normalize(pv.text).split(' ').filter(Boolean);
      const bTok = normalize(dbText).split(' ').filter(Boolean);

      // duplicate-word check on the DB side (independent of PDF)
      for (let k = 1; k < bTok.length; k++) {
        const key = tokenKey(bTok[k]);
        if (key && key === tokenKey(bTok[k - 1])) {
          findings.push({ ref: `${book.name} ${ch}:${n}`, cls: 'dup', pdf: '—', db: `${bTok[k - 1]} ${bTok[k]}` });
          stats.dup++;
        }
      }

      const hunks = diffTokens(aTok, bTok);
      for (let h = 0; h < hunks.length; h++) {
        const hk = hunks[h];
        if (hk.type === 'eq') {
          for (let t = 0; t < hk.a.length; t++) {
            if (hk.a[t].replace(QUOTES, '') !== hk.b[t].replace(QUOTES, '')) {
              stats.punct++;
              if (showPunct) findings.push({ ref: `${book.name} ${ch}:${n}`, cls: 'punct', pdf: hk.a[t], db: hk.b[t] });
            }
          }
          continue;
        }
        const pdfStr = hk.a.join(' '), dbStr = hk.b.join(' ');
        let cls;
        if (hk.type === 'sub') {
          if (hk.a.length === 1 && hk.b.length === 1) {
            const d = editDistance(tokenKey(hk.a[0]), tokenKey(hk.b[0]));
            cls = d <= 2 ? `char(${d})` : 'word';
          } else cls = 'word';
        } else if (hk.type === 'del') {
          const isTail = h === hunks.length - 1;
          const allSubtitle = hk.a.every(t => subtitleKeys.has(tokenKey(t)));
          cls = allSubtitle || (isTail && hk.a.length >= 2 && hk.a.length <= 8) ? 'heading?' : 'db-missing';
        } else cls = 'db-extra';
        stats[cls.startsWith('char') ? 'char' : cls.replace('?', '')] =
          (stats[cls.startsWith('char') ? 'char' : cls.replace('?', '')] || 0) + 1;
        findings.push({ ref: `${book.name} ${ch}:${n}`, cls, pdf: pdfStr || '—', db: dbStr || '—' });
      }
    }
  }
}

// ---------- main ----------
const books = await sql`SELECT id, name, amharic_name, chapters FROM books ORDER BY id`;
const targets = allMode ? books : (() => {
  const b = books.find(x => x.name.toLowerCase() === bookArg.toLowerCase() || x.amharic_name === bookArg)
        || books.find(x => x.name.toLowerCase().startsWith(bookArg.toLowerCase()));
  if (!b) { console.error(`ERROR: book not found: ${bookArg}`); process.exit(3); }
  return [b];
})();

const findings = [];
const stats = { chaptersChecked: 0, chaptersUnparsed: 0, versesChecked: 0, punct: 0, dup: 0 };
const sorted = [...pageBooks];
for (const book of targets) {
  // page_map names use underscores: "1_Chronicles" vs DB "1 Chronicles"
  const pi = sorted.findIndex(p =>
    p.name.replace(/_/g, ' ').toLowerCase() === book.name.toLowerCase());
  if (pi === -1) {
    findings.push({ ref: book.name, cls: 'no-page-map', pdf: '—', db: '—' });
    continue;
  }
  const nextStart = sorted[pi + 1]?.start_page ?? null;
  process.stderr.write(`checking ${book.name}…\n`);
  try {
    await verifyBook(book, sorted[pi], nextStart, findings, stats);
  } catch (e) {
    findings.push({ ref: book.name, cls: 'error', pdf: '—', db: e.message.slice(0, 120) });
  }
}

// ---------- report ----------
const order = ['error', 'no-page-map', 'chapter-unparsed', 'verse-missing', 'db-extra', 'dup', 'db-missing', 'word', 'char(1)', 'char(2)', 'heading?', 'punct'];
const rank = c => { const i = order.indexOf(c); return i === -1 ? order.length : i; };
findings.sort((x, y) => rank(x.cls) - rank(y.cls) || x.ref.localeCompare(y.ref, undefined, { numeric: true }));

const byClass = {};
for (const f of findings) byClass[f.cls] = (byClass[f.cls] || 0) + 1;

const esc = s => String(s).replace(/\|/g, '\\|');
const lines = [];
lines.push(`# Bible text verification — DB vs Emmaus PDF text layer`);
lines.push('');
lines.push(`**Scope:** ${allMode ? 'all books' : targets.map(t => t.name + (onlyChapter ? ' ' + onlyChapter : '')).join(', ')}  `);
lines.push(`**Date:** ${new Date().toISOString().slice(0, 10)}  `);
lines.push(`**Chapters checked:** ${stats.chaptersChecked}${stats.chaptersUnparsed ? ` (+${stats.chaptersUnparsed} unparsed)` : ''}  `);
lines.push(`**Verses compared:** ${stats.versesChecked}  `);
lines.push(`**Punctuation-only diffs (፥/፤ etc.):** ${stats.punct}${showPunct ? '' : ' (hidden; rerun with --punct)'}  `);
lines.push('');
lines.push('## Findings by class');
lines.push('');
lines.push('| class | count |');
lines.push('|---|---|');
for (const c of Object.keys(byClass).sort((a, b) => rank(a) - rank(b))) lines.push(`| ${c} | ${byClass[c]} |`);
lines.push('');
lines.push('## Detail');
lines.push('');
lines.push('| ref | class | PDF (ground truth) | DB |');
lines.push('|---|---|---|---|');
for (const f of findings) lines.push(`| ${f.ref} | ${f.cls} | ${esc(f.pdf)} | ${esc(f.db)} |`);
lines.push('');
const report = lines.join('\n');

if (outFile) { writeFileSync(outFile, report); console.error(`report → ${outFile} (${findings.length} findings)`); }
else console.log(report);
