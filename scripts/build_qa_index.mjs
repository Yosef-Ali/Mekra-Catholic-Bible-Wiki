#!/usr/bin/env node
// Extract all Q&A items from extracted/*.md into a single JSON index.
// Output: raw/catechism/qa_index.json
// Each entry: { q: number, question: string, answer: string, ccc: string[], source: string, printed_pages: [left, right] }

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VAULT = '/Users/mekdesyared/Mekra-Catholic-Bible-Wiki';
const EXTRACTED = path.join(VAULT, 'raw/catechism/extracted');
const OUT = path.join(VAULT, 'raw/catechism/qa_index.json');

function parseFrontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---/m);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

const files = (await readdir(EXTRACTED)).filter(f => f.endsWith('.md')).sort();
const allQA = new Map(); // q number -> entry (dedup, prefer first seen)

for (const f of files) {
  const md = await readFile(path.join(EXTRACTED, f), 'utf8');
  const fm = parseFrontmatter(md);
  const pages = [fm.printed_page_left || 'none', fm.printed_page_right || 'none'];

  // Split by ## headings
  const sections = md.split(/^## /m).slice(1); // skip everything before first ##
  for (const sec of sections) {
    const lines = sec.trim().split('\n');
    const heading = lines[0].trim();
    // Extract Q number from heading
    const qMatch = heading.match(/^(\d+)/);
    if (!qMatch) continue;
    const q = parseInt(qMatch[1]);
    if (q < 1 || q > 598) continue; // skip CCC refs mistaken as Q numbers

    if (allQA.has(q)) continue; // keep first occurrence

    let question = '', answer = '', ccc = [];
    let mode = 'scan';
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('**Q:**') || line.startsWith('**Q:')) {
        question = line.replace(/^\*\*Q:\*\*\s*/, '').trim();
        mode = 'q';
      } else if (line.startsWith('**A:**') || line.startsWith('**A:')) {
        answer = line.replace(/^\*\*A:\*\*\s*/, '').trim();
        mode = 'a';
      } else if (line.match(/^\[CCC/)) {
        const refs = line.match(/\d[\d\-,\s]*/g);
        if (refs) ccc.push(...refs.map(r => r.trim()));
      } else if (mode === 'q' && !line.startsWith('**') && !line.startsWith('[') && line.trim()) {
        question += ' ' + line.trim();
      } else if (mode === 'a' && !line.startsWith('**') && !line.startsWith('[') && !line.startsWith('##') && line.trim()) {
        answer += ' ' + line.trim();
      }
    }

    allQA.set(q, {
      q,
      question: question.trim(),
      answer: answer.trim(),
      ccc,
      source: f,
      printed_pages: pages,
    });
  }
}

const sorted = [...allQA.values()].sort((a, b) => a.q - b.q);
await writeFile(OUT, JSON.stringify(sorted, null, 2));
console.log(`Indexed ${sorted.length} Q&A items (Q${sorted[0]?.q}–Q${sorted[sorted.length-1]?.q})`);

// Report missing
const found = new Set(sorted.map(e => e.q));
const missing = [];
for (let i = 1; i <= 598; i++) if (!found.has(i)) missing.push(i);
console.log(`Missing: ${missing.length} → ${missing.join(', ')}`);
