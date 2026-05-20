/**
 * Batch Fix Chapter Formatting Script
 * 
 * Processes ALL chapters in the database to add formatting rules
 * Uses Gemini 2.0 Flash with rate limiting and progress tracking
 * 
 * Usage:
 *   npx tsx scripts/batch-fix-formatting.ts              # Process all books
 *   npx tsx scripts/batch-fix-formatting.ts --book 147   # Process specific book
 *   npx tsx scripts/batch-fix-formatting.ts --resume     # Resume from last position
 */

import { config } from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../services/db';
import { chapterContents, books } from '../services/schema';
import { eq, and, isNull, sql, asc } from 'drizzle-orm';
import * as fs from 'fs';

config();

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey });

// Progress file for resume functionality
const PROGRESS_FILE = 'formatting-progress.json';

// Known poetic passages - comprehensive list
const POETRY_HINTS: Record<string, Record<number, string>> = {
  'Genesis': {
    3: 'Verses 14-19: God\'s curses on serpent, Eve, Adam - poetic oracles',
    9: 'Verses 25-27: Noah\'s blessing - poetic',
    49: 'Verses 1-27: Jacob\'s blessing of his sons - entirely poetic'
  },
  'Exodus': {
    15: 'Verses 1-21: Song of Moses and Miriam - entirely poetic',
    20: 'Verses 1-17: Ten Commandments - structured list format'
  },
  'Numbers': {
    6: 'Verses 24-26: Priestly Blessing - poetic',
    21: 'Verses 17-18: Song of the Well - poetic',
    23: 'Balaam\'s oracles - poetic sections',
    24: 'Balaam\'s oracles - poetic sections'
  },
  'Deuteronomy': {
    32: 'Verses 1-43: Song of Moses - entirely poetic',
    33: 'Verses 1-29: Moses\' blessing - entirely poetic'
  },
  'Job': {
    // Almost entirely poetry except prose prologue/epilogue
  },
  'Psalms': {
    // All psalms are poetry
  },
  'Proverbs': {
    // All proverbs are poetry
  },
  'Ecclesiastes': {
    // Mixed poetry and prose
  },
  'Song of Songs': {
    // Entirely poetry
  },
  'Isaiah': {
    // Mostly poetry
  },
  'Lamentations': {
    // Entirely poetry (acrostic)
  }
};

// Books that are entirely or mostly poetry
const POETRY_BOOKS = ['Psalms', 'Proverbs', 'Job', 'Song of Songs', 'Lamentations', 'Isaiah', 'Jeremiah', 'Ezekiel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah'];

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

interface Progress {
  lastBookId: number;
  lastChapter: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  startTime: string;
}

// Load and save progress functions
function loadProgress(): Progress | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (e) {
    console.log('Could not load progress file');
  }
  return null;
}

function saveProgress(progress: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Get poetry hints for a specific book/chapter
 */
function getPoetryHints(bookName: string, chapter: number): string {
  // Check if book is mostly poetry
  if (POETRY_BOOKS.includes(bookName)) {
    return `**Note:** This is a ${bookName} chapter - typically contains poetry/verse formatting`;
  }
  
  const bookHints = POETRY_HINTS[bookName];
  if (bookHints && bookHints[chapter]) {
    return `**Known poetic passage:** ${bookHints[chapter]}`;
  }
  return '';
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
 * Analyze chapter and generate formatting rules using Gemini
 */
async function analyzeChapterFormatting(
  bookName: string,
  bookAmharicName: string,
  chapterNumber: number,
  rawContent: string,
  retryCount = 0
): Promise<FormattingRules> {
  const poetryHints = getPoetryHints(bookName, chapterNumber);
  
  const prompt = `Analyze this Amharic Catholic Bible chapter to identify formatting types.

**Book:** ${bookAmharicName} (${bookName}) - Chapter ${chapterNumber}
${poetryHints}

**Content (first 12000 chars):**
${rawContent.substring(0, 12000)}

**Identify verse ranges for:**
1. **Poetry** - Parallelism, songs, blessings, curses, prophetic oracles
2. **Lists** - Commandments, genealogies, enumerated items
3. **Prose** - Regular narrative
4. **Footnotes** - Reference notes (marked with *)

Return JSON with the formatting structure.`;

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
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
                  verseRange: { type: Type.ARRAY, items: { type: Type.NUMBER } },
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
    if (retryCount < 3) {
      const delay = (retryCount + 1) * 5000;
      console.log(`   ⏳ Retry ${retryCount + 1}/3 after ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return analyzeChapterFormatting(bookName, bookAmharicName, chapterNumber, rawContent, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Process a single chapter
 */
async function processChapter(
  bookId: number,
  bookName: string,
  bookAmharicName: string,
  chapterNumber: number,
  content: any
): Promise<{ success: boolean; message: string }> {
  try {
    const rawText = extractRawText(content);
    if (!rawText || rawText.length < 50) {
      return { success: false, message: 'Content too short or empty' };
    }

    const formattingRules = await analyzeChapterFormatting(
      bookName,
      bookAmharicName,
      chapterNumber,
      rawText
    );

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

    return { 
      success: true, 
      message: `Poetry: ${formattingRules.hasPoetry ? 'Yes' : 'No'}, Style: ${formattingRules.primaryStyle}` 
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: errMsg };
  }
}

/**
 * Get all chapters needing formatting
 */
async function getChaptersToProcess(specificBookId?: number) {
  let query = db
    .select({
      bookId: chapterContents.bookId,
      chapterNumber: chapterContents.chapterNumber,
      content: chapterContents.content,
      bookName: books.name,
      bookAmharicName: books.amharicName
    })
    .from(chapterContents)
    .leftJoin(books, eq(chapterContents.bookId, books.id))
    .where(isNull(chapterContents.formattingRules))
    .orderBy(asc(chapterContents.bookId), asc(chapterContents.chapterNumber));

  if (specificBookId) {
    // @ts-ignore
    query = query.where(and(
      isNull(chapterContents.formattingRules),
      eq(chapterContents.bookId, specificBookId)
    ));
  }

  return query;
}

/**
 * Main batch processing function
 */
async function batchProcess(options: { bookId?: number; resume?: boolean }) {
  console.log('🚀 Starting batch formatting process...\n');
  
  let progress: Progress = {
    lastBookId: 0,
    lastChapter: 0,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    startTime: new Date().toISOString()
  };

  // Load progress if resuming
  if (options.resume) {
    const savedProgress = loadProgress();
    if (savedProgress) {
      progress = savedProgress;
      console.log(`📂 Resuming from: Book ${progress.lastBookId}, Chapter ${progress.lastChapter}`);
      console.log(`   Previous: ${progress.processedCount} processed, ${progress.successCount} success, ${progress.failedCount} failed\n`);
    }
  }

  // Get chapters to process
  const chapters = await getChaptersToProcess(options.bookId);
  console.log(`📚 Found ${chapters.length} chapters to process\n`);

  if (chapters.length === 0) {
    console.log('✅ All chapters already have formatting rules!');
    return;
  }

  // Filter if resuming
  let chaptersToProcess = chapters;
  if (options.resume && progress.lastBookId > 0) {
    chaptersToProcess = chapters.filter(c => 
      c.bookId > progress.lastBookId || 
      (c.bookId === progress.lastBookId && c.chapterNumber > progress.lastChapter)
    );
    console.log(`📂 After resume filter: ${chaptersToProcess.length} chapters remaining\n`);
  }

  const total = chaptersToProcess.length;
  const startTime = Date.now();
  let currentBookId = 0;
  let currentBookName = '';

  for (let i = 0; i < total; i++) {
    const chapter = chaptersToProcess[i];
    
    // Print book header when book changes
    if (chapter.bookId !== currentBookId) {
      currentBookId = chapter.bookId;
      currentBookName = chapter.bookAmharicName || chapter.bookName || 'Unknown';
      console.log(`\n📖 ${currentBookName} (${chapter.bookName}) [ID: ${chapter.bookId}]`);
    }

    const pct = ((i + 1) / total * 100).toFixed(1);
    process.stdout.write(`   [${pct}%] Ch. ${chapter.chapterNumber}... `);

    const result = await processChapter(
      chapter.bookId,
      chapter.bookName || 'Unknown',
      chapter.bookAmharicName || '',
      chapter.chapterNumber,
      chapter.content
    );

    progress.processedCount++;
    progress.lastBookId = chapter.bookId;
    progress.lastChapter = chapter.chapterNumber;

    if (result.success) {
      progress.successCount++;
      console.log(`✅ ${result.message}`);
    } else {
      progress.failedCount++;
      console.log(`❌ ${result.message}`);
    }

    // Save progress every 10 chapters
    if (i % 10 === 0) {
      saveProgress(progress);
    }

    // Rate limiting: 2 seconds between API calls
    if (i < total - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Final save
  saveProgress(progress);

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 BATCH PROCESSING COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Total processed: ${progress.processedCount}`);
  console.log(`   ✅ Success: ${progress.successCount}`);
  console.log(`   ❌ Failed: ${progress.failedCount}`);
  console.log(`   ⏱️ Time: ${elapsed} minutes`);
  console.log(`   📈 Rate: ${(progress.processedCount / parseFloat(elapsed)).toFixed(1)} chapters/min`);
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  
  const options: { bookId?: number; resume?: boolean } = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--book' && args[i + 1]) {
      options.bookId = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--resume') {
      options.resume = true;
    }
  }

  if (args.includes('--help')) {
    console.log(`
📖 Batch Fix Formatting Tool

Usage:
  npx tsx scripts/batch-fix-formatting.ts              # Process all books
  npx tsx scripts/batch-fix-formatting.ts --book 147   # Process specific book (Genesis)
  npx tsx scripts/batch-fix-formatting.ts --resume     # Resume from last position

Book IDs:
  147 = Genesis, 148 = Exodus, 149 = Leviticus, 150 = Numbers
  151 = Deuteronomy, 169 = Psalms, etc.
    `);
    process.exit(0);
  }

  await batchProcess(options);
}

main().catch(console.error);
