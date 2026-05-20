import { config } from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('❌ Missing GEMINI_API_KEY');
    process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey, httpOptions: { timeout: 300_000 } });
const PDF_FILE = path.join(process.cwd(), 'The Amharic Bible Catholic Edition - Emmaus.pdf');
const PAGES_DIR = path.join(process.cwd(), 'extraction_output', 'pages');
const MODEL = 'gemini-3-flash-preview';

export interface ExtractedVerse {
    verse_number: number;
    text: string;
}

export interface ExtractedChapter {
    book: string;
    chapter: number;
    verses: ExtractedVerse[];
}

export interface ExtractionResult {
    pages: number[];
    chapters: ExtractedChapter[];
    raw_response: string;
}

const EXTRACTION_PROMPT = `You are an expert Amharic Bible text extractor. Extract ALL text from this Bible page image.

OUTPUT FORMAT (strict JSON):
{
  "chapters": [
    {
      "book": "ኦሪት ዘፍጥረት",
      "chapter": 1,
      "verses": [
        { "verse_number": 1, "text": "..." },
        { "verse_number": 2, "text": "..." }
      ]
    }
  ]
}

RULES:
1. Extract EVERY verse visible on the page — missing verses is the worst error.
2. Preserve exact Ge'ez characters (ሀ ሁ ሂ ሃ ሄ ህ ሆ etc.) — do NOT substitute similar-looking characters.
3. If a page spans multiple chapters, include all of them as separate entries.
4. If a verse is split across columns, merge it into one continuous text.
5. Include verse numbers exactly as printed.
6. Preserve punctuation marks: ። ፥ ፤ ፡ " "
7. Do NOT add any text not visible in the image.

Return ONLY the JSON object, no markdown fences.`;

/**
 * Walk the string starting at the first '{' and return the substring up to its
 * matching closing '}'. Respects string literals and escape sequences so braces
 * inside string values don't confuse the counter. Returns null if no balanced
 * object is found.
 */
function extractBalancedJson(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch === '"') { inString = false; }
            continue;
        }

        if (ch === '"') { inString = true; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

export async function extractPage(pageNum: number): Promise<ExtractionResult> {
    const imageFile = path.join(PAGES_DIR, `page_${pageNum}.png`);

    // Convert PDF page to image if not cached
    if (!fs.existsSync(imageFile)) {
        fs.mkdirSync(PAGES_DIR, { recursive: true });
        const gsCmd = `gs -sDEVICE=png16m -r300 -o "${imageFile}" -dFirstPage=${pageNum} -dLastPage=${pageNum} "${PDF_FILE}"`;
        execSync(gsCmd, { stdio: 'pipe' });
    }

    const imageBase64 = fs.readFileSync(imageFile).toString('base64');

    const result = await genAI.models.generateContent({
        model: MODEL,
        contents: [{
            role: 'user',
            parts: [
                { text: EXTRACTION_PROMPT },
                { inlineData: { mimeType: 'image/png', data: imageBase64 } }
            ]
        }]
    });

    const rawText = result.text ?? '';
    // Strip markdown fences if present
    let jsonStr = rawText;
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) { jsonStr = fenceMatch[1]; }

    // Extract the first balanced JSON object (handles trailing extra braces / pre-text)
    jsonStr = extractBalancedJson(jsonStr) ?? jsonStr.trim();

    let parsed: { chapters: ExtractedChapter[] };
    try {
        parsed = JSON.parse(jsonStr);
    } catch {
        console.error(`❌ Failed to parse JSON for page ${pageNum}. Raw response:\n${rawText}`);
        return { pages: [pageNum], chapters: [], raw_response: rawText };
    }

    return {
        pages: [pageNum],
        chapters: parsed.chapters,
        raw_response: rawText
    };
}

// CLI entry point
if (process.argv[1].endsWith('test-vision.ts')) {
    const targetPage = parseInt(process.argv[2] || '49', 10);
    console.log(`🖼️  Extracting page ${targetPage} using ${MODEL}...`);

    extractPage(targetPage).then(result => {
        const outFile = path.join(process.cwd(), 'extraction_output', `vision_page_${targetPage}.json`);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

        const verseCount = result.chapters.reduce((sum, ch) => sum + ch.verses.length, 0);
        console.log(`✅ Extracted ${result.chapters.length} chapter(s), ${verseCount} verse(s)`);
        console.log(`📄 Saved to ${outFile}`);
    }).catch(err => {
        console.error('❌ Extraction failed:', err);
        process.exit(1);
    });
}
