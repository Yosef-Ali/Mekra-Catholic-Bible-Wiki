#!/usr/bin/env node
/**
 * generate_review_files.mjs — build the priest-facing review files from a
 * verify_bible_text.mjs report.
 *
 * Input:  a report produced by `node scripts/verify_bible_text.mjs --all --out <f>`
 * Output: docs/bible-review/00-ማውጫ.md (index) + NN-<amharic-book>.md per book
 *
 * Only categories needing human judgment are included:
 *   word / char(N)      → ቃል ተለውጧል   (wording differs from print)
 *   db-missing          → በአፑ ጎድሏል    (print words absent in app)
 *   db-extra            → በአፑ ተጨማሪ    (app words absent in print — NEVER auto-deleted)
 *   dup                 → ድግግሞሽ       (doubled word; many are legit reduplication)
 *   verse-missing (DB)  → ጥቅስ ጠፍቷል    (verse absent in app)
 * Excluded: punct (trivial), heading? (section headings), verse-missing on
 * the PDF side (parser noise, not app defects).
 *
 * Usage: node scripts/generate_review_files.mjs <report.md>
 * Read-only with respect to the DB (book list lookup only).
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

const APP_ENV = '/Users/mekdesyared/Mekra-Catholic-Bible/.env';
if (!process.env.DATABASE_URL && existsSync(APP_ENV)) {
  for (const line of readFileSync(APP_ENV, 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) { process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, ''); break; }
  }
}
const sql = neon(process.env.DATABASE_URL);

const reportPath = process.argv[2];
if (!reportPath || !existsSync(reportPath)) {
  console.error('Usage: node scripts/generate_review_files.mjs <verify-report.md>');
  process.exit(1);
}
const OUT_DIR = '/Users/mekdesyared/Mekra-Catholic-Bible-Wiki/docs/bible-review';

// ---------- category mapping ----------
const CATS = {
  'word': { label: 'ቃል ተለውጧል', order: 1 },
  'char(1)': { label: 'ቃል ተለውጧል', order: 1 },
  'char(2)': { label: 'ቃል ተለውጧል', order: 1 },
  'db-missing': { label: 'በአፑ ጎድሏል', order: 2 },
  'db-extra': { label: 'በአፑ ተጨማሪ', order: 3 },
  'dup': { label: 'ድግግሞሽ', order: 4 },
  'verse-missing': { label: 'ጥቅስ ጠፍቷል', order: 0 },
};

// ---------- parse the report ----------
const lines = readFileSync(reportPath, 'utf8').split('\n');
const items = [];   // {book, ch, v, cat, pdf, db}
let inDetail = false;
for (const line of lines) {
  if (line.startsWith('## Detail')) { inDetail = true; continue; }
  if (!inDetail || !line.startsWith('| ')) continue;
  if (line.startsWith('| ref |') || line.startsWith('|---')) continue;
  const cells = line.replace(/^\|\s*/, '').replace(/\s*\|$/, '').split(' | ');
  if (cells.length < 4) continue;
  const [ref, cls, pdf, db] = cells;
  const cat = CATS[cls];
  if (!cat) continue;                                          // punct / heading? etc.
  if (cls === 'verse-missing' && db !== '(absent in DB)') continue; // parser-side noise
  // real Amharic scripture never contains Arabic digits: a digit on the
  // print side means page-number/outline/running-head leakage, not a finding
  if (cls !== 'verse-missing' && /\d/.test(pdf)) continue;
  const m = ref.match(/^(.+) (\d+):(\d+)$/);
  if (!m) continue;
  items.push({ book: m[1], ch: +m[2], v: +m[3], cls, cat, pdf, db });
}

// ---------- book metadata ----------
const books = await sql`SELECT id, name, amharic_name FROM books ORDER BY id`;
const byBook = new Map(books.map(b => [b.name, []]));
for (const it of items) byBook.get(it.book)?.push(it);

mkdirSync(OUT_DIR, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const slug = s => s.replace(/\s+/g, '-');

// ---------- per-book files ----------
const indexRows = [];
let filesWritten = 0, totalItems = 0;
for (const [pos, b] of books.entries()) {
  const num = pos + 1;                       // canonical 1–73, not the DB id
  const list = byBook.get(b.name) ?? [];
  const counts = {};
  for (const it of list) counts[it.cat.label] = (counts[it.cat.label] || 0) + 1;
  const fname = `${String(num).padStart(2, '0')}-${slug(b.amharic_name)}.md`;
  indexRows.push({ b, num, n: list.length, counts, fname });
  if (list.length === 0) {
    rmSync(`${OUT_DIR}/${fname}`, { force: true });  // stale file from a prior run
    continue;
  }

  list.sort((x, y) => x.ch - y.ch || x.v - y.v || x.cat.order - y.cat.order);
  const out = [];
  out.push(`# ${b.amharic_name} (${b.name}) — የመጽሐፍ ቅዱስ ጽሑፍ ማረጋገጫ`);
  out.push('');
  out.push(`**ቀን፦** ${today} · **የሚታዩ ነጥቦች፦** ${list.length}`);
  out.push('');
  out.push('«በመጽሐፉ» = በታተመው የኤማሁስ መጽሐፍ ቅዱስ ውስጥ ያለው ቃል። «በአፑ» = በመተግበሪያው ውስጥ ያለው ቃል።');
  out.push('እባክዎ የታተመውን መጽሐፍ እየተመለከቱ በ«ውሳኔ» አምድ ላይ ✓ (መጽሐፉ ትክክል)፣ ✗ (አፑ ትክክል) ወይም ማስታወሻ ይጻፉ።');
  out.push('');
  out.push('| ጥቅስ | ጉዳይ | በመጽሐፉ | በአፑ | ውሳኔ |');
  out.push('|---|---|---|---|---|');
  for (const it of list) {
    out.push(`| ${it.ch}፥${it.v} | ${it.cat.label} | ${it.pdf} | ${it.db} |  |`);
  }
  out.push('');
  writeFileSync(`${OUT_DIR}/${fname}`, out.join('\n'));
  filesWritten++;
  totalItems += list.length;
}

// ---------- index ----------
const idx = [];
idx.push('# የመጽሐፍ ቅዱስ ጽሑፍ ማረጋገጫ — ማውጫ');
idx.push('');
idx.push(`**ቀን፦** ${today} · **መጻሕፍት፦ ${filesWritten} የሚታዩ ነጥቦች ያሉባቸው** · **ጠቅላላ ነጥቦች፦** ${totalItems}`);
idx.push('');
idx.push('ለእያንዳንዱ መጽሐፍ የተለየ ፋይል አለ። መመሪያውን በ [README.md](README.md) ይመልከቱ።');
idx.push('');
idx.push('| # | መጽሐፍ | ጠቅላላ | ቃል ተለውጧል | በአፑ ጎድሏል | በአፑ ተጨማሪ | ድግግሞሽ | ጥቅስ ጠፍቷል |');
idx.push('|---|---|---|---|---|---|---|---|');
for (const r of indexRows) {
  const c = r.counts;
  const link = r.n ? `[${r.b.amharic_name}](${encodeURI(r.fname)})` : `${r.b.amharic_name} ✓`;
  idx.push(`| ${r.num} | ${link} | ${r.n} | ${c['ቃል ተለውጧል'] || ''} | ${c['በአፑ ጎድሏል'] || ''} | ${c['በአፑ ተጨማሪ'] || ''} | ${c['ድግግሞሽ'] || ''} | ${c['ጥቅስ ጠፍቷል'] || ''} |`);
}
idx.push('');
writeFileSync(`${OUT_DIR}/00-ማውጫ.md`, idx.join('\n'));

console.log(`review files → ${OUT_DIR}`);
console.log(`books with items: ${filesWritten}/${books.length}, total items: ${totalItems}`);
