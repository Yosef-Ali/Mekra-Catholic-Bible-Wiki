/**
 * Fix ALL remaining chapters missing formatting rules.
 *
 * Group A — have structure_page data (apply from PDF extraction):
 *   Matthew 9 (page 533), 1 Corinthians 8-9 (page 615)
 *
 * Group B — no structure data, extract subtitles from DB content section titles:
 *   Jeremiah 13-14, Revelation 5-7
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { sql } from '../services/db';

const BASE = path.join(process.cwd(), 'extraction_output');

interface Subtitle { text: string; before_verse: number }
interface ChStruct { chapter: number; subtitles: Subtitle[]; paragraph_breaks: number[]; poetry_ranges: Array<[number, number]> }

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

// ── Group A: from structure files ──

interface StructAgg { subtitles: Map<number, string>; pbs: Set<number>; poetry: Array<[number, number]> }

function readStructure(pages: number[], targetChs: number[]): Map<number, StructAgg> {
  const agg = new Map<number, StructAgg>();
  for (const p of pages) {
    const f = path.join(BASE, `structure_page_${p}.json`);
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, 'utf-8'));
    for (const ch of (d.chapters || []) as ChStruct[]) {
      if (!targetChs.includes(ch.chapter)) continue;
      if (!agg.has(ch.chapter)) agg.set(ch.chapter, { subtitles: new Map(), pbs: new Set(), poetry: [] });
      const e = agg.get(ch.chapter)!;
      for (const s of ch.subtitles || []) e.subtitles.set(s.before_verse, s.text);
      for (const pb of ch.paragraph_breaks || []) e.pbs.add(pb);
      for (const pr of ch.poetry_ranges || []) e.poetry.push(pr);
    }
  }
  return agg;
}

function aggToRules(e: StructAgg) {
  return {
    subtitles: Array.from(e.subtitles.entries()).sort((a, b) => a[0] - b[0]).map(([v, t]) => ({ verse: v, text: t })),
    paragraphBreaks: Array.from(e.pbs).sort((a, b) => a - b),
    hasPoetry: e.poetry.length > 0,
    sections: mergeRanges(e.poetry).map(([s, t]) => ({ verseRange: [s, t], type: 'poetry', indent: 1 })),
  };
}

// ── Group B: extract from DB content section titles ──

async function extractFromContent(bookId: number, chapterNumber: number): Promise<any> {
  const rows = await sql`
    SELECT content FROM formatted_chapter_contents
    WHERE book_id = ${bookId} AND chapter_number = ${chapterNumber}
    LIMIT 1
  ` as Array<{ content: any }>;

  if (rows.length === 0) return null;
  const content = rows[0].content;
  if (!content?.sections) return null;

  const subtitles: Array<{ verse: number; text: string }> = [];
  const paragraphBreaks: number[] = [];

  for (const section of content.sections) {
    if (section.title) {
      const firstVerse = section.verses?.[0]?.verse_number || 1;
      subtitles.push({ verse: firstVerse, text: section.title });
    }
    for (const v of section.verses || []) {
      if (v.is_new_paragraph) paragraphBreaks.push(v.verse_number);
    }
  }

  // If no paragraph breaks from content, auto-break every 5 verses
  if (paragraphBreaks.length === 0) {
    const allVerses = content.sections.flatMap((s: any) => (s.verses || []).map((v: any) => v.verse_number));
    for (let i = 0; i < allVerses.length; i += 5) {
      if (allVerses[i] > 1) paragraphBreaks.push(allVerses[i]);
    }
  }

  return {
    subtitles,
    paragraphBreaks: [...new Set(paragraphBreaks)].sort((a, b) => a - b),
    hasPoetry: false,
    sections: [],
  };
}

// ── Main ──

async function applyRules(bookId: number, label: string, chNum: number, rules: any) {
  const res = await sql`
    UPDATE formatted_chapter_contents
    SET formatting_rules = ${JSON.stringify(rules)}::jsonb, updated_at = NOW()
    WHERE book_id = ${bookId} AND chapter_number = ${chNum}
    RETURNING id
  `;
  const subs = rules.subtitles?.length || 0;
  const pbs = rules.paragraphBreaks?.length || 0;
  console.log(`${label} ch${chNum}: ${res.length ? `✅ (${subs} subs, ${pbs} pbs)` : '❌ NOT FOUND'}`);
}

async function main() {
  console.log('=== Group A: from PDF structure files ===\n');

  // Matthew 9 (page 533, book_id 193)
  const matt = readStructure([533], [9]);
  for (const [ch, e] of matt) await applyRules(193, 'Matthew', ch, aggToRules(e));

  // 1 Corinthians 8-9 (page 615, book_id 199)
  const cor1 = readStructure([615, 616], [8, 9]);
  for (const [ch, e] of cor1) await applyRules(199, '1 Cor', ch, aggToRules(e));

  console.log('\n=== Group B: from DB content section titles ===\n');

  // Jeremiah 13-14 (book_id 176)
  for (const ch of [13, 14]) {
    const rules = await extractFromContent(176, ch);
    if (rules) await applyRules(176, 'Jeremiah', ch, rules);
    else console.log(`Jeremiah ch${ch}: ❌ no content in DB`);
  }

  // Revelation 5-7 (book_id 219)
  for (const ch of [5, 6, 7]) {
    const rules = await extractFromContent(219, ch);
    if (rules) await applyRules(219, 'Revelation', ch, rules);
    else console.log(`Revelation ch${ch}: ❌ no content in DB`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error('❌', err); process.exit(1); });
