#!/usr/bin/env node
// Parse extracted/*.md frontmatter and build a page-number map.
// Output: raw/catechism/page_map.json + a gap report to stdout.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VAULT = '/Users/mekdesyared/Mekra-Catholic-Bible-Wiki';
const EXTRACTED = path.join(VAULT, 'raw/catechism/extracted');
const OUT_JSON  = path.join(VAULT, 'raw/catechism/page_map.json');

function parseFrontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/m);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function parsePage(v) {
  if (!v || v === 'none') return null;
  const uncertain = v.endsWith('?');
  const clean = v.replace(/\?$/, '').trim();
  const n = Number(clean);
  if (Number.isNaN(n)) return { raw: v, n: null, uncertain: true };
  return { raw: v, n, uncertain };
}

const files = (await readdir(EXTRACTED)).filter(f => f.endsWith('.md')).sort();
const entries = [];
const reviewList = [];

for (const f of files) {
  const md = await readFile(path.join(EXTRACTED, f), 'utf8');
  const fm = parseFrontmatter(md);
  if (!fm) { reviewList.push({ file: f, reason: 'no frontmatter' }); continue; }
  const left  = parsePage(fm.printed_page_left);
  const right = parsePage(fm.printed_page_right);
  entries.push({
    file: f,
    layout: fm.layout,
    left, right,
    section: fm.section_heading,
    needs_review: fm.needs_review === 'yes',
    reason: fm.needs_review_reason,
  });
  if (fm.needs_review === 'yes') {
    reviewList.push({ file: f, reason: fm.needs_review_reason });
  }
}

// Build page-number → [{file, side}] index
const pageIndex = new Map();
for (const e of entries) {
  for (const side of ['left', 'right']) {
    const p = e[side];
    if (p && p.n !== null) {
      if (!pageIndex.has(p.n)) pageIndex.set(p.n, []);
      pageIndex.get(p.n).push({ file: e.file, side, uncertain: p.uncertain });
    }
  }
}

// Gap analysis — assume pages should run from min to max with no holes
const nums = [...pageIndex.keys()].sort((a, b) => a - b);
const min = nums[0], max = nums[nums.length - 1];
const missing = [];
for (let i = min; i <= max; i++) if (!pageIndex.has(i)) missing.push(i);

// Duplicates
const duplicates = [];
for (const [n, list] of pageIndex) if (list.length > 1) duplicates.push({ page: n, list });

// Front matter (pages that couldn't be numbered — TOC, title, etc.)
const frontMatter = entries.filter(e =>
  (!e.left || e.left.n === null) && (!e.right || e.right.n === null)
);

await writeFile(OUT_JSON, JSON.stringify({
  stats: { files: entries.length, minPage: min, maxPage: max, numberedPages: pageIndex.size, missing: missing.length, duplicates: duplicates.length, frontMatter: frontMatter.length },
  entries,
  pageIndex: Object.fromEntries(pageIndex),
  missing,
  duplicates,
  frontMatter: frontMatter.map(e => e.file),
  reviewList,
}, null, 2));

console.log('=== PAGE MAP SUMMARY ===');
console.log(`Files:            ${entries.length}`);
console.log(`Body pages range: ${min} – ${max}  (${pageIndex.size} unique numbered)`);
console.log(`Missing pages:    ${missing.length}`);
console.log(`Duplicate pages:  ${duplicates.length}`);
console.log(`Front matter:     ${frontMatter.length} files (no printed page number)`);
console.log(`Needs review:     ${reviewList.length} files`);

if (missing.length) {
  console.log('\n=== MISSING PAGES (rescan these) ===');
  // Compact run-length format: 5, 12-15, 99
  const runs = [];
  let a = missing[0], b = missing[0];
  for (let i = 1; i < missing.length; i++) {
    if (missing[i] === b + 1) b = missing[i];
    else { runs.push(a === b ? `${a}` : `${a}-${b}`); a = b = missing[i]; }
  }
  runs.push(a === b ? `${a}` : `${a}-${b}`);
  console.log(runs.join(', '));
}

if (duplicates.length) {
  console.log('\n=== DUPLICATE PAGE NUMBERS ===');
  for (const d of duplicates) {
    console.log(`  p.${d.page}: ${d.list.map(x => `${x.file} (${x.side})`).join(' + ')}`);
  }
}

if (frontMatter.length) {
  console.log('\n=== FRONT MATTER FILES ===');
  for (const e of frontMatter) console.log(`  ${e.file}`);
}

if (reviewList.length) {
  console.log('\n=== NEEDS REVIEW ===');
  for (const r of reviewList.slice(0, 20)) console.log(`  ${r.file}: ${r.reason}`);
  if (reviewList.length > 20) console.log(`  ...and ${reviewList.length - 20} more`);
}

console.log(`\nFull map written to: ${OUT_JSON}`);
