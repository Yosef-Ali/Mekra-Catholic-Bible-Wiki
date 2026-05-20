import fs from 'fs';
import type { ExtractedChapter } from './test-vision.js';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma4:e2b';

export interface ReviewIssue {
    type: 'missing_verse' | 'duplicate_verse' | 'sequence_gap' | 'empty_text' | 'short_text' | 'encoding_suspect';
    severity: 'error' | 'warning';
    detail: string;
}

export interface ReviewReport {
    page: number;
    pass: boolean;
    issues: ReviewIssue[];
    llm_analysis: string | null;
    suggestion: string | null;
}

/**
 * Phase 1: Structural validation (deterministic, no LLM needed)
 */
function structuralCheck(chapters: ExtractedChapter[]): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    if (chapters.length === 0) {
        issues.push({ type: 'missing_verse', severity: 'error', detail: 'No chapters extracted at all' });
        return issues;
    }

    for (const ch of chapters) {
        if (!ch.verses || ch.verses.length === 0) {
            issues.push({ type: 'missing_verse', severity: 'error', detail: `${ch.book} ch.${ch.chapter}: zero verses` });
            continue;
        }

        const nums = ch.verses.map(v => v.verse_number);
        const seen = new Set<number>();

        for (let i = 0; i < nums.length; i++) {
            const n = nums[i];

            // Duplicate check
            if (seen.has(n)) {
                issues.push({ type: 'duplicate_verse', severity: 'error', detail: `${ch.book} ${ch.chapter}:${n} appears twice` });
            }
            seen.add(n);

            // Sequence gap check (allow chapter starts at any number)
            if (i > 0 && nums[i] !== nums[i - 1] + 1) {
                const gap = nums[i] - nums[i - 1];
                if (gap > 1) {
                    issues.push({
                        type: 'sequence_gap',
                        severity: 'error',
                        detail: `${ch.book} ${ch.chapter}: gap between v${nums[i - 1]} and v${nums[i]} (${gap - 1} missing)`
                    });
                } else if (gap <= 0) {
                    issues.push({
                        type: 'sequence_gap',
                        severity: 'warning',
                        detail: `${ch.book} ${ch.chapter}: out-of-order v${nums[i - 1]} → v${nums[i]}`
                    });
                }
            }

            // Empty/short text check
            const text = ch.verses[i].text?.trim() ?? '';
            if (text.length === 0) {
                issues.push({ type: 'empty_text', severity: 'error', detail: `${ch.book} ${ch.chapter}:${n} has empty text` });
            } else if (text.length < 5) {
                issues.push({ type: 'short_text', severity: 'warning', detail: `${ch.book} ${ch.chapter}:${n} suspiciously short: "${text}"` });
            }

            // Ge'ez encoding sanity: check for Latin substitutions in predominantly Amharic text
            const amharicChars = (text.match(/[\u1200-\u137F]/g) || []).length;
            const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
            if (text.length > 10 && latinChars > amharicChars * 0.3) {
                issues.push({
                    type: 'encoding_suspect',
                    severity: 'warning',
                    detail: `${ch.book} ${ch.chapter}:${n} has high Latin char ratio (${latinChars}/${text.length})`
                });
            }
        }
    }

    return issues;
}

import { GoogleGenAI } from '@google/genai';

/**
 * Phase 2: LLM-based semantic review via Gemini API 
 * Extremely fast and perfectly understands Ge'ez
 */
async function llmReview(chapters: ExtractedChapter[]): Promise<{ analysis: string; suggestion: string | null }> {
    const summary = chapters.map(ch => {
        const first = ch.verses[0]?.verse_number ?? '?';
        const last = ch.verses[ch.verses.length - 1]?.verse_number ?? '?';
        const sample = ch.verses.slice(0, 2).map(v => `  v${v.verse_number}: ${v.text.slice(0, 60)}...`).join('\n');
        return `${ch.book} chapter ${ch.chapter}, verses ${first}-${last} (${ch.verses.length} total)\n${sample}`;
    }).join('\n\n');

    const prompt = `You are a Bible QA reviewer for Amharic (Ge'ez script) extraction from a SINGLE PAGE of a printed Bible.

EXTRACTED DATA (only the first 2 verses of each chapter are shown as samples):
${summary}

IMPORTANT CONTEXT — DO NOT FLAG THESE AS ERRORS:
- Chapters routinely span across page boundaries. A chapter starting mid-page and continuing on the next page is NORMAL.
- The first chapter on a page may start at any verse number (not verse 1).
- The last chapter on a page may end at any verse number (not the final verse of the chapter).
- "Missing trailing verses" or "missing leading verses" of a chapter are EXPECTED at page boundaries — they appear on adjacent pages.
- You only see 2 sample verses per chapter, so you CANNOT judge whether middle verses are missing. Do not guess.
- Do not flag truncation of individual verse text unless the sample verse you can see is clearly cut mid-word.

ONLY FAIL IF you see one of these REAL problems:
1. The book name is clearly wrong (not a valid Amharic Bible book).
2. The chapter number is clearly wrong (negative or unrealistic).
3. The sample verses contain garbage, non-Amharic text, or OCR gibberish.
4. The verse_count is suspiciously tiny (e.g., 0-2 verses for an entire chapter shown).

Respond with:
VERDICT: PASS or FAIL
ISSUES: (list any REAL problems from the list above, or "none")
SUGGESTION: (only if FAIL, what to re-extract, or "none")`;

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
        const genAI = new GoogleGenAI({ apiKey, httpOptions: { timeout: 60000 } });
        
        const response = await genAI.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { temperature: 0.1 }
        });

        const rawText = response.text || '';
        // Strip markdown formatting: bold/italic markers, code fences, backticks
        const text = rawText
            .replace(/```[\s\S]*?```/g, '')   // code fences
            .replace(/\*\*\*/g, '')            // bold+italic
            .replace(/\*\*/g, '')              // bold
            .replace(/\*/g, '')                // italic
            .replace(/`/g, '')                 // inline code
            .replace(/^#+\s*/gm, '');          // heading markers

        const hasFail = /VERDICT:\s*FAIL/i.test(text);
        const suggestionMatch = text.match(/SUGGESTION:\s*(.+)/i);
        const suggestion = suggestionMatch?.[1]?.trim() || null;

        return {
            analysis: rawText,
            suggestion: hasFail ? (suggestion || 'Re-extract page') : null
        };
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️  Gemini review unavailable (${msg}), skipping LLM review`);
        return { analysis: 'Gemini API not available', suggestion: null };
    }
}

export async function reviewExtraction(chapters: ExtractedChapter[], page: number): Promise<ReviewReport> {
    // Phase 1: structural
    const issues = structuralCheck(chapters);
    const hasErrors = issues.some(i => i.severity === 'error');

    // Phase 2: LLM review (only if structure is clean)
    let llmResult = { analysis: null as string | null, suggestion: null as string | null };
    if (!hasErrors && chapters.length > 0) {
        llmResult = await llmReview(chapters);
    }

    return {
        page,
        pass: !hasErrors && !llmResult.suggestion,
        issues,
        llm_analysis: llmResult.analysis,
        suggestion: hasErrors
            ? `Structural errors found: ${issues.filter(i => i.severity === 'error').map(i => i.detail).join('; ')}`
            : llmResult.suggestion
    };
}

// CLI entry point
if (process.argv[1].endsWith('reviewer-agent-ollama.ts')) {
    const [,, jsonPath] = process.argv;
    if (!jsonPath) {
        console.log('Usage: npx tsx scripts/reviewer-agent-ollama.ts <extracted.json>');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const chapters = data.chapters ?? [];
    const page = data.pages?.[0] ?? 0;

    reviewExtraction(chapters, page).then(report => {
        console.log(`\n${report.pass ? '✅ PASS' : '❌ FAIL'} — Page ${report.page}`);
        if (report.issues.length > 0) {
            console.log('\n📋 Issues:');
            for (const issue of report.issues) {
                console.log(`  [${issue.severity}] ${issue.type}: ${issue.detail}`);
            }
        }
        if (report.llm_analysis) {
            console.log('\n🧐 LLM Analysis:');
            console.log(report.llm_analysis);
        }
        if (report.suggestion) {
            console.log(`\n💡 Suggestion: ${report.suggestion}`);
        }
    });
}
