/**
 * Structural-only Gemini Vision pass.
 *
 * Reads cached page images from extraction_output/pages/page_<N>.png and asks
 * Gemini ONLY for structural metadata (subtitles, paragraph breaks, poetry
 * ranges) — NOT verse text. Verse text is already clean in the DB.
 *
 * Output: extraction_output/structure_page_<N>.json
 *
 * Usage:
 *   pnpm tsx scripts/extract-structure.ts 10                # single page
 *   pnpm tsx scripts/extract-structure.ts 10 320 358        # several pages
 *   pnpm tsx scripts/extract-structure.ts --all             # all 671 pages
 */
import { config } from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error('❌ Missing GEMINI_API_KEY'); process.exit(1); }

const genAI = new GoogleGenAI({ apiKey, httpOptions: { timeout: 300_000 } });
const PAGES_DIR = path.join(process.cwd(), 'extraction_output', 'pages');
const OUT_DIR = path.join(process.cwd(), 'extraction_output');
const MODEL = 'gemini-3-flash-preview';

const STRUCTURE_PROMPT = `You are analyzing a single page of a printed Amharic Catholic Bible. Your job is to identify the page's STRUCTURAL formatting — subtitles, paragraph breaks, and poetry sections — exactly as they appear in print. Do NOT transcribe verse text.

Return strict JSON in this shape:
{
  "chapters": [
    {
      "chapter": 1,
      "subtitles": [
        { "text": "የፍጥረት መጀመሪያ", "before_verse": 1 }
      ],
      "paragraph_breaks": [5, 13, 19],
      "poetry_ranges": [[27, 28]]
    }
  ]
}

DEFINITIONS:
- "subtitles" = section headings printed in the book between verses (usually bold or styled differently from verse text). "before_verse" is the first verse number that appears UNDER the heading. Only include headings that are actually printed on the page; do NOT invent thematic titles.
- "paragraph_breaks" = list of verse numbers AFTER WHICH the printed text starts a new paragraph (i.e. there is a clear paragraph break before the next verse). Use the verse number that ENDS the previous paragraph.
- "poetry_ranges" = ranges of consecutive verse numbers that are typeset as indented poetry / verse-style stanzas (not flowing prose). Each range is [start_verse, end_verse] inclusive. Only include if the typesetting is clearly poetry.

RULES:
1. Identify chapters by the large chapter number printed on the page. If a page contains multiple chapters, return one entry per chapter.
2. If a chapter on this page has NO subtitles, no paragraph breaks, and no poetry — return it with empty arrays.
3. If a page has NO chapters (e.g., front matter, glossary, blank), return {"chapters": []}.
4. Verse numbers must match the printed verse markers (Arabic or Ge'ez digits). Use Arabic integers in the JSON.
5. Do NOT transcribe any verse text.
6. Do NOT invent or paraphrase subtitles — copy them exactly as printed in Amharic.

Return ONLY the JSON object, no markdown fences, no commentary.`;

function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

export interface Subtitle { text: string; before_verse: number }
export interface ChapterStructure {
  chapter: number;
  subtitles: Subtitle[];
  paragraph_breaks: number[];
  poetry_ranges: Array<[number, number]>;
}
export interface PageStructure {
  page: number;
  chapters: ChapterStructure[];
  raw_response: string;
}

export async function extractStructure(pageNum: number): Promise<PageStructure> {
  const imageFile = path.join(PAGES_DIR, `page_${pageNum}.png`);
  if (!fs.existsSync(imageFile)) {
    throw new Error(`Page image not found: ${imageFile}`);
  }
  const imageBase64 = fs.readFileSync(imageFile).toString('base64');

  const result = await genAI.models.generateContent({
    model: MODEL,
    contents: [{
      role: 'user',
      parts: [
        { text: STRUCTURE_PROMPT },
        { inlineData: { mimeType: 'image/png', data: imageBase64 } },
      ],
    }],
  });

  const raw = result.text ?? '';
  let jsonStr = raw;
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1];
  jsonStr = extractBalancedJson(jsonStr) ?? jsonStr.trim();

  let parsed: { chapters: ChapterStructure[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error(`❌ Failed to parse JSON for page ${pageNum}. Raw:\n${raw.slice(0, 500)}`);
    return { page: pageNum, chapters: [], raw_response: raw };
  }

  // Normalize defaults
  const chapters = (parsed.chapters || []).map(c => ({
    chapter: c.chapter,
    subtitles: c.subtitles || [],
    paragraph_breaks: c.paragraph_breaks || [],
    poetry_ranges: c.poetry_ranges || [],
  }));

  return { page: pageNum, chapters, raw_response: raw };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: pnpm tsx scripts/extract-structure.ts <page> [page...] | --all');
    process.exit(1);
  }

  let pages: number[];
  if (args.includes('--all')) {
    pages = [];
    for (const f of fs.readdirSync(OUT_DIR)) {
      const m = f.match(/^vision_page_(\d+)\.json$/);
      if (m) pages.push(parseInt(m[1], 10));
    }
    pages.sort((a, b) => a - b);
  } else {
    pages = args.map(a => parseInt(a, 10)).filter(n => Number.isFinite(n));
  }

  // Filter out cached pages first so the worker pool only processes work.
  const todo: number[] = [];
  let cached = 0;
  for (const p of pages) {
    if (fs.existsSync(path.join(OUT_DIR, `structure_page_${p}.json`))) cached++;
    else todo.push(p);
  }

  const concurrencyArg = args.find(a => a.startsWith('--concurrency='));
  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 8;
  console.log(`Extracting structure: ${todo.length} to do, ${cached} cached, concurrency=${concurrency}\n`);

  let ok = 0, fail = 0;
  let idx = 0;

  async function worker(workerId: number) {
    while (true) {
      const myIdx = idx++;
      if (myIdx >= todo.length) return;
      const p = todo[myIdx];
      const outFile = path.join(OUT_DIR, `structure_page_${p}.json`);
      try {
        const result = await extractStructure(p);
        fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
        const subs = result.chapters.reduce((s, c) => s + c.subtitles.length, 0);
        const breaks = result.chapters.reduce((s, c) => s + c.paragraph_breaks.length, 0);
        const poetry = result.chapters.reduce((s, c) => s + c.poetry_ranges.length, 0);
        console.log(`  [w${workerId}] ✅ page ${p}: ${result.chapters.length}ch ${subs}sub ${breaks}¶ ${poetry}poetry`);
        ok++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  [w${workerId}] ❌ page ${p}: ${msg}`);
        fail++;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  console.log(`\nDone. ok=${ok} fail=${fail} cached=${cached}`);
}

main().catch(err => { console.error('❌ Failed:', err); process.exit(1); });
