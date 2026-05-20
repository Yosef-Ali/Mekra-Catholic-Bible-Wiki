/**
 * Fix 2 Corinthians chs 1-7 formatting rules.
 * These chapters are on PDF pages 620-622 which page_map.json assigns to 1_Corinthians,
 * so merge-structure.ts misattributes them. This script reads the structure data directly
 * and applies it to 2 Corinthians (book_id 200) + 1 Corinthians 8-9 (book_id 199).
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { sql } from '../services/db';

interface Subtitle { text: string; before_verse: number }
interface ChStruct { chapter: number; subtitles: Subtitle[]; paragraph_breaks: number[]; poetry_ranges: Array<[number, number]> }
interface PageStruct { page: number; chapters: ChStruct[] }

const BASE = path.join(process.cwd(), 'extraction_output');

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i][0] <= last[1] + 1) last[1] = Math.max(last[1], sorted[i][1]);
    else out.push(sorted[i]);
  }
  return out;
}

interface Agg {
  subtitles: Map<number, string>;
  pbs: Set<number>;
  poetry: Array<[number, number]>;
}

async function main() {
  // 2 Corinthians chs 1-7 from pages 620-622
  const cor2Agg = new Map<number, Agg>();
  for (const p of [620, 621, 622]) {
    const d: PageStruct = JSON.parse(fs.readFileSync(path.join(BASE, `structure_page_${p}.json`), 'utf-8'));
    for (const ch of d.chapters || []) {
      if (ch.chapter < 1 || ch.chapter > 7) continue;
      if (!cor2Agg.has(ch.chapter)) cor2Agg.set(ch.chapter, { subtitles: new Map(), pbs: new Set(), poetry: [] });
      const e = cor2Agg.get(ch.chapter)!;
      for (const s of ch.subtitles || []) e.subtitles.set(s.before_verse, s.text);
      for (const pb of ch.paragraph_breaks || []) e.pbs.add(pb);
      for (const pr of ch.poetry_ranges || []) e.poetry.push(pr);
    }
  }

  // 1 Corinthians chs 8-9 from pages 620 (if present)
  const cor1Agg = new Map<number, Agg>();
  for (const p of [616, 617, 618, 619, 620]) {
    const f = path.join(BASE, `structure_page_${p}.json`);
    if (!fs.existsSync(f)) continue;
    const d: PageStruct = JSON.parse(fs.readFileSync(f, 'utf-8'));
    for (const ch of d.chapters || []) {
      if (ch.chapter < 8 || ch.chapter > 16) continue;
      if (!cor1Agg.has(ch.chapter)) cor1Agg.set(ch.chapter, { subtitles: new Map(), pbs: new Set(), poetry: [] });
      const e = cor1Agg.get(ch.chapter)!;
      for (const s of ch.subtitles || []) e.subtitles.set(s.before_verse, s.text);
      for (const pb of ch.paragraph_breaks || []) e.pbs.add(pb);
      for (const pr of ch.poetry_ranges || []) e.poetry.push(pr);
    }
  }

  async function applyRules(bookId: number, bookName: string, agg: Map<number, Agg>) {
    for (const [chNum, e] of agg) {
      const rules = {
        subtitles: Array.from(e.subtitles.entries()).sort((a, b) => a[0] - b[0]).map(([v, t]) => ({ verse: v, text: t })),
        paragraphBreaks: Array.from(e.pbs).sort((a, b) => a - b),
        hasPoetry: e.poetry.length > 0,
        sections: mergeRanges(e.poetry).map(([s, t]) => ({ verseRange: [s, t], type: 'poetry', indent: 1 })),
      };
      const res = await sql`
        UPDATE formatted_chapter_contents
        SET formatting_rules = ${JSON.stringify(rules)}::jsonb, updated_at = NOW()
        WHERE book_id = ${bookId} AND chapter_number = ${chNum}
        RETURNING id
      `;
      console.log(`${bookName} ch${chNum}: ${res.length ? `✅ updated (id=${(res[0] as any).id})` : '❌ NOT FOUND'}`);
    }
  }

  console.log('--- 2 Corinthians (book_id=200) chs 1-7 ---');
  await applyRules(200, '2 Cor', cor2Agg);

  console.log('\n--- 1 Corinthians (book_id=199) chs 8-9 ---');
  await applyRules(199, '1 Cor', cor1Agg);
}

main().then(() => process.exit(0)).catch(err => { console.error('❌', err); process.exit(1); });
