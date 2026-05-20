/**
 * Shared types, prompts, and helpers for the Bible extraction pipeline.
 * Used by: bible-extract.ts, bible-review.ts, bible-test-sample.ts
 *
 * NOTE: We do NOT use Gemini's responseSchema because it causes Node.js 25
 * fetch failures (request body too large). Instead we embed the JSON format
 * in the prompt and use only responseMimeType: 'application/json'.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExtractedVerse {
  verse_number: number;
  text: string;
  is_new_paragraph: boolean;
  indent: number;
}

export interface ExtractedSection {
  type: 'prose' | 'poetry';
  subtitle_level: string;
  subtitle_text: string;
  verses: ExtractedVerse[];
}

export interface ExtractedChapter {
  chapter_number: number;
  sections: ExtractedSection[];
}

export interface ExtractedBook {
  book_name: string;
  amharic_name: string;
  start_page: number;
  end_page: number;
  chapters: ExtractedChapter[];
}

// ─── System Prompt (includes JSON format spec) ──────────────────────────────

export function buildSystemPrompt(): string {
  return `You are a strict transcription tool for an Amharic Catholic Bible PDF.

ABSOLUTE RULES — NO EXCEPTIONS:
1. COPY Amharic text CHARACTER-FOR-CHARACTER exactly as printed. Never generate, complete, paraphrase, or infer any word.
2. NEVER substitute, correct, modernize, or fix any Amharic word. Preserve exact characters: ሀ ≠ ሐ ≠ ኀ, ሰ ≠ ሠ, ጸ ≠ ፀ, አ ≠ ዐ.
3. If any text is unclear or partially obscured, write [unclear] — never guess.
4. Do NOT include: page numbers, running page headers, footnote marker symbols (*, †, ‡).
5. Verse numbers come from the printed superscript or inline numerals on the page only.

WHAT TO IDENTIFY:

SECTION TYPE — look at the visual layout:
• "prose"  — standard narrative text, letters, narrative passages
• "poetry" — text printed with visible line-by-line indentation or stanza breaks
  (Psalms, hymns, laments, blessings, oracles, songs)
  Use indent: 0 for main lines, 1 for first-level indent, 2 for deeper indent.
  For prose sections, always use indent: 0.

SUBTITLES — headings printed BETWEEN verse groups (not chapter numbers):
• "double" — a section heading with a decorative rule/line printed BOTH above AND below the heading text (major section break, bold/centered)
• "single" — a heading in bold text with only ONE rule or no rule (minor section heading)
• ""        — empty string means this section has NO subtitle heading before it
Set subtitle_text to the exact printed heading text, or "" if none.

PARAGRAPH BREAKS:
• Set is_new_paragraph: true on the FIRST verse of every new paragraph block.
• A new paragraph = the printed text has an indent at the start of a line, OR a visible blank-line gap between verse groups.
• Always set is_new_paragraph: true for verse 1 of each chapter.
• For all other verses, set is_new_paragraph: false unless a visible paragraph break precedes them.

OUTPUT FORMAT — Return valid JSON matching this exact structure:
{
  "chapters": [
    {
      "chapter_number": 1,
      "sections": [
        {
          "type": "prose",
          "subtitle_level": "",
          "subtitle_text": "",
          "verses": [
            {
              "verse_number": 1,
              "text": "exact Amharic text here...",
              "is_new_paragraph": true,
              "indent": 0
            }
          ]
        }
      ]
    }
  ]
}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`❌ Missing environment variable: ${name}`);
    console.error(`   Make sure it's set in your .env file`);
    process.exit(1);
  }
  return val;
}

/**
 * Strip markdown code fences from Gemini responses.
 * Without responseMimeType, Gemini may wrap JSON in ```json ... ```
 */
export function cleanJsonResponse(raw: string): string {
  let text = raw.trim();
  // Remove ```json ... ``` or ``` ... ``` wrapping
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return text.trim();
}

// ─── Paths ───────────────────────────────────────────────────────────────────

import path from 'path';

export const PDF_PATH    = path.join(process.cwd(), 'The Amharic Bible Catholic Edition - Emmaus.pdf');
export const OUTPUT_DIR  = path.join(process.cwd(), 'extraction_output');
export const RAW_DIR     = path.join(OUTPUT_DIR, 'raw');
export const MAP_PATH    = path.join(OUTPUT_DIR, 'page_map.json');
export const HANDLE_PATH = path.join(OUTPUT_DIR, 'file_handle.json');
export const REPORT_PATH = path.join(OUTPUT_DIR, 'validation_report.json');
