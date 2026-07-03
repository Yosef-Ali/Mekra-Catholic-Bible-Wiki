#!/usr/bin/env node
/**
 * extract_book_intros.mjs — extract each book's printed introduction from
 * the Emmaus PDF text layer into raw/bible/intros/.
 *
 * Every book in the printed Emmaus Bible opens with:
 *   [display title lines]          e.g. የጌታችን የኢየሱስ ክርስቶስ ወንጌል / ቅዱስ ሉቃስ እንደ ጻፈው
 *   መግቢያ                          historical-context introduction (prose)
 *   አጠቃላይ የመጽሐፉ ይዘት              content outline with verse ranges
 *   ምዕራፍ 1 …                      (chapter text — not part of the intro)
 *
 * None of this made it into the app DB (the verse pipeline drops non-verse
 * material by design). This script recovers it as one markdown file per
 * book: raw/bible/intros/NN-<EnglishName>.md, with bold-field metadata.
 *
 * Read-only everywhere: reads the PDF + page map + DB book list, writes
 * only under raw/bible/intros/. Loading into the app DB is done by the
 * app repo's scripts/load_book_intros.mjs.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const APP_DIR = '/Users/mekdesyared/Mekra-Catholic-Bible';
const PDF = `${APP_DIR}/The Amharic Bible Catholic Edition - Emmaus.pdf`;
const PAGE_MAP = `${APP_DIR}/extraction_output/page_map.json`;
const OUT_DIR = '/Users/mekdesyared/Mekra-Catholic-Bible-Wiki/raw/bible/intros';

const APP_ENV = `${APP_DIR}/.env`;
if (!process.env.DATABASE_URL && existsSync(APP_ENV)) {
  for (const line of readFileSync(APP_ENV, 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) { process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, ''); break; }
  }
}
const sql = neon(process.env.DATABASE_URL);

function* findBooks(o) {
  if (Array.isArray(o)) { for (const v of o) yield* findBooks(v); }
  else if (o && typeof o === 'object') {
    if ('start_page' in o && 'amharic' in o) yield o;
    else for (const v of Object.values(o)) yield* findBooks(v);
  }
}
const pageBooks = [...findBooks(JSON.parse(readFileSync(PAGE_MAP, 'utf8')))];
const books = await sql`SELECT id, name, amharic_name, chapters FROM books ORDER BY id`;

const pdfPage = (f, l) => execFileSync('pdftotext',
  ['-f', String(f), '-l', String(l), '-enc', 'UTF-8', PDF, '-'],
  { maxBuffer: 16 * 1024 * 1024 }).toString('utf8');

const INVIS = /[⁠​﻿­]/g;
const norm = s => s.replace(INVIS, '').replace(/[\d‑–-]+/g, '').replace(/\s+/g, ' ').trim();

mkdirSync(OUT_DIR, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
let ok = 0;
const missing = [];

for (const [pos, b] of books.entries()) {
  const num = pos + 1;
  const pb = pageBooks.find(p => p.name.replace(/_/g, ' ').toLowerCase() === b.name.toLowerCase());
  if (!pb) { missing.push(`${b.name}: no page map`); continue; }

  // the intro lives on the book's first page; pull a second page only if
  // the first has መግቢያ but no chapter marker yet (long intro)
  // NB: the check must be line-anchored — the WORD መግቢያ ("entrance") occurs
  // inside chapter text (Joshua's gates, 1 Macc headings!), only a bare
  // መግቢያ line before ምዕራፍ 1 is the intro heading. Try the start page
  // first, then prepend the previous page (books start mid-spread).
  const nt = norm(b.amharic_name);
  const parseIntro = (text) => {
    const lines = text.split('\n').map(l => l.replace(INVIS, '').replace(/[\x00-\x1F\x7F]/g, '').trimEnd());
    let cut = lines.findIndex(l => /^(ምዕራፍ|መዝሙር)\s+1(?!\d)\s*$/.test(l.trim()));
    if (cut === -1 && b.chapters === 1)
      cut = lines.findIndex(l => /^1\s?[ሀ-፿“«]/.test(l.trim()));
    const head = cut === -1 ? lines : lines.slice(0, cut);
    const gIdx = head.findIndex(l => l.trim() === 'መግቢያ');
    if (gIdx === -1) return null;
    const pre = head.slice(0, gIdx).map(l => l.trim()).filter(l => {
      if (!l) return false;
      if (/^\d+$/.test(l)) return false;
      const nl = norm(l);
      if (nl && nl === nt) return false;
      if (nl && nl.startsWith(nt) && nl.length <= nt.length + 8) return false;
      return true;
    });
    const titleLines = [];
    for (let i = pre.length - 1; i >= 0 && titleLines.length < 4; i--) {
      if (/[።!?፤]/.test(pre[i])) break;
      titleLines.unshift(pre[i]);
    }
    const body = head.slice(gIdx + 1);
    const oIdx = body.findIndex(l => /^አጠቃላይ የመጽሐፉ ይዘት\s*$/.test(l.trim()));
    const proseLines = (oIdx === -1 ? body : body.slice(0, oIdx))
      .map(l => l.trim())
      .filter(l => l && !/^\d+$/.test(l)
        && !(norm(l) && norm(l).startsWith(nt) && norm(l).length <= nt.length + 8)
        && !/^\d+፥\d+/.test(l)
        && !/^[ሀ-፿]\s+\d+፥\d+/.test(l));
    // collect outline items, stopping at the first digits-only line — books
    // whose chapter 1 opens with a drop-cap numeral (no ምዕራፍ word) put that
    // bare "1" right after the outline, then chapter section headings follow
    const outlineLines = [];
    for (const raw of (oIdx === -1 ? [] : body.slice(oIdx + 1))) {
      const l = raw.replace(INVIS, '').replace(/[\x00-\x1F\x7F]/g, '').trim();
      if (!l) continue;
      if (/^[\d\s]+$/.test(l)) break;                             // drop-cap / page number → chapter text begins
      const nl = norm(l);
      if (nl && nl.startsWith(nt) && nl.length <= nt.length + 8) continue; // running head
      outlineLines.push(l);
    }
    if (proseLines.length < 2) return null;
    return { titleLines, prose: proseLines.join(' ').replace(/\s+/g, ' ').trim(), outlineLines };
  };

  const p0 = pdfPage(pb.start_page, pb.start_page);
  const candidates = [p0];
  if (pb.start_page > 1)
    candidates.push(pdfPage(pb.start_page - 1, pb.start_page - 1) + '\n' + p0);
  let parsed = null;
  for (let cand of candidates) {
    // long intro spilling to the next page
    const introLine = cand.split('\n').some(l => l.trim() === 'መግቢያ');
    if (introLine && !/(ምዕራፍ|መዝሙር)\s+1(?!\d)/.test(cand) && pb.end_page > pb.start_page)
      cand += '\n' + pdfPage(pb.start_page + 1, pb.start_page + 1);
    parsed = parseIntro(cand);
    if (parsed) break;
  }
  if (!parsed) { missing.push(`${b.name}: no usable መግቢያ near p.${pb.start_page}`); continue; }
  const { titleLines, prose, outlineLines } = parsed;

  const out = [];
  out.push(`# ${b.amharic_name} (${b.name}) — መግቢያ`);
  out.push('');
  out.push(`**Type:** book-intro`);
  out.push(`**Book:** ${b.name}`);
  out.push(`**Amharic:** ${b.amharic_name}`);
  if (titleLines.length) out.push(`**Display title:** ${titleLines.join(' · ')}`);
  out.push(`**Source:** Emmaus PDF p. ${pb.start_page}`);
  out.push(`**Extracted:** ${today}`);
  out.push('');
  out.push('## መግቢያ');
  out.push('');
  out.push(prose);
  if (outlineLines.length) {
    out.push('');
    out.push('## አጠቃላይ የመጽሐፉ ይዘት');
    out.push('');
    for (const l of outlineLines) out.push(`- ${l}`);
  }
  out.push('');
  writeFileSync(`${OUT_DIR}/${String(num).padStart(2, '0')}-${b.name.replace(/\s+/g, '_')}.md`, out.join('\n'));
  ok++;
}

console.log(`intros extracted: ${ok}/${books.length} → ${OUT_DIR}`);
if (missing.length) { console.log('\nnot extracted:'); for (const m of missing) console.log('  ' + m); }
