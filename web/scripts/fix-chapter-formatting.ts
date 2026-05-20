/**
 * Fix Chapter Formatting Script
 * 
 * This script fixes formatting issues in the Bible seed data to match
 * the original PDF formatting (poetry, lists, footnotes)
 * 
 * Usage:
 *   npx tsx scripts/fix-chapter-formatting.ts [bookId] [startChapter] [endChapter]
 * 
 * Examples:
 *   npx tsx scripts/fix-chapter-formatting.ts 147 1 50    # All Genesis
 *   npx tsx scripts/fix-chapter-formatting.ts 148 1 40    # All Exodus
 */

import { config } from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../services/db';
import { chapterContents, books } from '../services/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

config();

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey });

// Known poetic passages for better detection
const POETRY_HINTS: Record<string, string[]> = {
  'Genesis': [
    '3:14-19 (God\'s curses on serpent, Eve, Adam - poetic oracles)',
    '9:25-27 (Noah\'s blessing - poetic)',
    '49:1-27 (Jacob\'s blessing of his sons - entirely poetic)'
  ],
  'Exodus': [
    '15:1-21 (Song of Moses and Miriam - entirely poetic)',
    '20:1-17 (Ten Commandments - structured list format)'
  ],
  'Numbers': [
    '6:24-26 (Priestly Blessing - poetic)',
    '21:17-18 (Song of the Well - poetic)'
  ],
  'Deuteronomy': [
    '32:1-43 (Song of Moses - entirely poetic)',
    '33:1-29 (Moses\' blessing - entirely poetic)'
  ]
};


interface FormattingSection {
  type: 'title' | 'poetry' | 'prose' | 'list' | 'footnote';
  title?: string;
  verseRange: [number, number];
  indent?: number;
}

interface FormattingRules {
  sections: FormattingSection[];
  footnotes?: Array<{ verseRef: string; marker: string; text: string }>;
  hasPoetry: boolean;
  hasLists: boolean;
  hasFootnotes: boolean;
  primaryStyle: 'prose' | 'poetry' | 'mixed';
}

interface ChapterReport {
  bookId: number;
  bookName: string;
  chapterNumber: number;
  status: 'success' | 'failed' | 'skipped';
  message: string;
  formattingRules?: FormattingRules;
}


/**
 * Get poetry hints for a specific book/chapter
 */
function getPoetryHints(bookName: string, chapter: number): string {
  const bookHints = POETRY_HINTS[bookName];
  if (!bookHints) return '';
  
  const relevantHints = bookHints.filter(hint => {
    const match = hint.match(/^(\d+):/);
    if (match) {
      const hintChapter = parseInt(match[1]);
      return hintChapter === chapter;
    }
    return false;
  });
  
  if (relevantHints.length === 0) return '';
  return `\n**Known poetic passages in this chapter:**\n${relevantHints.map(h => `- ${h}`).join('\n')}`;
}

/**
 * Analyze chapter and generate formatting rules using Gemini
 */
async function analyzeChapterFormatting(
  bookName: string,
  bookAmharicName: string,
  chapterNumber: number,
  rawContent: string
): Promise<FormattingRules> {
  const poetryHints = getPoetryHints(bookName, chapterNumber);
  
  const prompt = `You are analyzing an Amharic Catholic Bible chapter to identify formatting.

**Book:** ${bookAmharicName} (${bookName})
**Chapter:** ${chapterNumber}
${poetryHints}

**Content to analyze:**
${rawContent.substring(0, 15000)}

**TASK:** Identify the verse ranges for different formatting types:

1. **Poetry** - Look for:
   - Hebrew parallelism (similar ideas repeated)
   - God's formal speeches, blessings, curses
   - Songs, prayers, laments
   - Prophetic oracles

2. **Lists** - Enumerated items like commandments, genealogies

3. **Prose** - Regular narrative text

4. **Footnotes** - Reference notes (marked with *)

**OUTPUT:** Return a JSON object with verse ranges for each formatting type.

Example output structure:
{
  "sections": [
    {"type": "prose", "verseRange": [1, 13]},
    {"type": "poetry", "verseRange": [14, 19], "indent": 1},
    {"type": "prose", "verseRange": [20, 24]}
  ],
  "hasPoetry": true,
  "hasLists": false,
  "hasFootnotes": false,
  "primaryStyle": "mixed"
}`;


  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',  // Using flash for faster processing
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  verseRange: { 
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER }
                  },
                  title: { type: Type.STRING },
                  indent: { type: Type.NUMBER }
                },
                required: ['type', 'verseRange']
              }
            },
            hasPoetry: { type: Type.BOOLEAN },
            hasLists: { type: Type.BOOLEAN },
            hasFootnotes: { type: Type.BOOLEAN },
            primaryStyle: { type: Type.STRING }
          },
          required: ['sections', 'hasPoetry', 'hasLists', 'hasFootnotes', 'primaryStyle']
        },
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) throw new Error('No response from Gemini');
    return JSON.parse(text);
  } catch (error) {
    console.error(`Failed to analyze ${bookAmharicName} ${chapterNumber}:`, error);
    throw error;
  }
}


/**
 * Check if a chapter needs formatting fixes
 */
async function checkChapterNeedsFixing(bookId: number, chapterNumber: number): Promise<boolean> {
  const [chapter] = await db
    .select()
    .from(chapterContents)
    .where(
      and(
        eq(chapterContents.bookId, bookId),
        eq(chapterContents.chapterNumber, chapterNumber)
      )
    );

  if (!chapter) return false;
  
  // Check if formatting_rules is null or empty
  const rules = chapter.formattingRules as FormattingRules | null;
  if (!rules || !rules.sections || rules.sections.length === 0) {
    return true;
  }
  
  return false;
}

/**
 * Extract raw text from chapter content
 */
function extractRawText(content: any): string {
  let rawText = '';
  
  if (content.sections) {
    rawText = content.sections
      .map((s: any) => {
        let text = '';
        if (s.title) text += `${s.title}\n`;
        if (s.verses) {
          text += s.verses.map((v: any) => `[${v.verse_number}] ${v.text}`).join('\n');
        }
        return text;
      })
      .join('\n\n');
  } else if (typeof content === 'string') {
    rawText = content;
  } else {
    rawText = JSON.stringify(content, null, 2);
  }
  
  return rawText;
}


/**
 * Process a single chapter
 */
async function processChapter(
  bookId: number, 
  chapterNumber: number,
  forceReprocess: boolean = false
): Promise<ChapterReport> {
  const [book] = await db.select().from(books).where(eq(books.id, bookId));
  if (!book) {
    return {
      bookId,
      bookName: 'Unknown',
      chapterNumber,
      status: 'failed',
      message: 'Book not found'
    };
  }

  // Check if needs fixing
  if (!forceReprocess) {
    const needsFixing = await checkChapterNeedsFixing(bookId, chapterNumber);
    if (!needsFixing) {
      return {
        bookId,
        bookName: book.name,
        chapterNumber,
        status: 'skipped',
        message: 'Already has formatting rules'
      };
    }
  }

  console.log(`\n📖 Processing: ${book.amharicName} (${book.name}) - Chapter ${chapterNumber}`);

  // Get chapter content
  const [chapter] = await db
    .select()
    .from(chapterContents)
    .where(
      and(
        eq(chapterContents.bookId, bookId),
        eq(chapterContents.chapterNumber, chapterNumber)
      )
    );

  if (!chapter) {
    return {
      bookId,
      bookName: book.name,
      chapterNumber,
      status: 'failed',
      message: 'Chapter not found in database'
    };
  }


  try {
    const rawText = extractRawText(chapter.content);
    console.log(`   📄 Content length: ${rawText.length} chars`);

    // Analyze with Gemini
    console.log(`   🤖 Analyzing formatting...`);
    const formattingRules = await analyzeChapterFormatting(
      book.name,
      book.amharicName,
      chapterNumber,
      rawText
    );

    console.log(`   ✅ Analysis complete:`);
    console.log(`      - Sections: ${formattingRules.sections.length}`);
    console.log(`      - Poetry: ${formattingRules.hasPoetry ? 'Yes' : 'No'}`);
    console.log(`      - Style: ${formattingRules.primaryStyle}`);

    // Update database
    await db
      .update(chapterContents)
      .set({
        formattingRules: formattingRules as any,
        verified: 1,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(chapterContents.bookId, bookId),
          eq(chapterContents.chapterNumber, chapterNumber)
        )
      );

    console.log(`   💾 Saved to database`);

    return {
      bookId,
      bookName: book.name,
      chapterNumber,
      status: 'success',
      message: 'Formatting rules updated',
      formattingRules
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Failed: ${errorMsg}`);
    return {
      bookId,
      bookName: book.name,
      chapterNumber,
      status: 'failed',
      message: errorMsg
    };
  }
}


/**
 * Find all chapters missing formatting rules
 */
async function findChaptersMissingFormatting(): Promise<Array<{bookId: number, bookName: string, chapterNumber: number}>> {
  const results = await db
    .select({
      bookId: chapterContents.bookId,
      chapterNumber: chapterContents.chapterNumber,
      bookName: books.name
    })
    .from(chapterContents)
    .leftJoin(books, eq(chapterContents.bookId, books.id))
    .where(isNull(chapterContents.formattingRules));
  
  return results.map(r => ({
    bookId: r.bookId,
    bookName: r.bookName || 'Unknown',
    chapterNumber: r.chapterNumber
  }));
}

/**
 * Process multiple chapters with delay
 */
async function processChapters(
  bookId: number,
  startChapter: number,
  endChapter: number,
  delayMs: number = 2000
): Promise<ChapterReport[]> {
  const [book] = await db.select().from(books).where(eq(books.id, bookId));
  if (!book) {
    console.error(`Book ${bookId} not found`);
    return [];
  }

  const end = Math.min(endChapter, book.chapters);
  const total = end - startChapter + 1;
  
  console.log(`\n🚀 Processing ${book.amharicName} (${book.name})`);
  console.log(`   Chapters: ${startChapter} to ${end} (${total} chapters)\n`);

  const reports: ChapterReport[] = [];
  
  for (let chapter = startChapter; chapter <= end; chapter++) {
    console.log(`\n[${chapter - startChapter + 1}/${total}]`);
    const report = await processChapter(bookId, chapter);
    reports.push(report);
    
    if (chapter < end && report.status !== 'skipped') {
      console.log(`   ⏳ Waiting ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  
  return reports;
}


/**
 * Print summary report
 */
function printSummary(reports: ChapterReport[]) {
  const success = reports.filter(r => r.status === 'success');
  const failed = reports.filter(r => r.status === 'failed');
  const skipped = reports.filter(r => r.status === 'skipped');
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Total: ${reports.length}`);
  console.log(`   ✅ Success: ${success.length}`);
  console.log(`   ⏭️ Skipped: ${skipped.length}`);
  console.log(`   ❌ Failed: ${failed.length}`);
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed chapters:`);
    failed.forEach(r => {
      console.log(`   - ${r.bookName} ${r.chapterNumber}: ${r.message}`);
    });
  }
  
  if (success.length > 0) {
    const withPoetry = success.filter(r => r.formattingRules?.hasPoetry);
    console.log(`\n📜 Chapters with poetry: ${withPoetry.length}`);
    withPoetry.forEach(r => {
      console.log(`   - ${r.bookName} ${r.chapterNumber}`);
    });
  }
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === '--find-missing') {
    console.log('🔍 Finding chapters missing formatting rules...\n');
    const missing = await findChaptersMissingFormatting();
    console.log(`Found ${missing.length} chapters without formatting rules:`);
    
    // Group by book
    const byBook: Record<string, number[]> = {};
    missing.forEach(m => {
      if (!byBook[m.bookName]) byBook[m.bookName] = [];
      byBook[m.bookName].push(m.chapterNumber);
    });
    
    Object.entries(byBook).forEach(([book, chapters]) => {
      console.log(`\n${book}: ${chapters.length} chapters`);
      console.log(`   Chapters: ${chapters.sort((a,b) => a-b).join(', ')}`);
    });
    return;
  }

  if (args.length < 2) {
    console.log(`
📖 Fix Chapter Formatting Tool

Usage:
  npx tsx scripts/fix-chapter-formatting.ts <bookId> <startChapter> [endChapter]
  npx tsx scripts/fix-chapter-formatting.ts --find-missing

Examples:
  npx tsx scripts/fix-chapter-formatting.ts 147 1 50     # All Genesis
  npx tsx scripts/fix-chapter-formatting.ts 148 15       # Exodus 15 (Song of Moses)
  npx tsx scripts/fix-chapter-formatting.ts --find-missing
    `);
    process.exit(1);
  }

  const bookId = parseInt(args[0]);
  const start = parseInt(args[1]);
  const end = args[2] ? parseInt(args[2]) : start;

  const reports = await processChapters(bookId, start, end);
  printSummary(reports);
}

main().catch(console.error);
