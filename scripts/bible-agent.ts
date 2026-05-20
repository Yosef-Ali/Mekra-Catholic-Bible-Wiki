import { config } from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../services/db';
import { chapterContents, books } from '../services/schema';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { CATHOLIC_BOOKS } from '../constants';

// Load environment variables
config();

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey });

const EXTRACT_DIR = path.join(process.cwd(), 'extraction_output');
const RAW_TEXT_FILE = path.join(EXTRACT_DIR, 'raw_text.txt');
const PDF_FILE = path.join(process.cwd(), 'The Amharic Bible Catholic Edition - Emmaus.pdf');

// Ensure output directory exists
if (!fs.existsSync(EXTRACT_DIR)) {
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
}

/**
 * PDF name variants: constants.ts names that differ from the actual PDF text.
 * Keys are the English book name, values are the Amharic name AS IT APPEARS in the PDF.
 */
const PDF_NAME_VARIANTS: Record<string, string> = {
  "Exodus": "ኦሪት ዘፀአት",        // constants has ዘጸአት (different ጸ/ፀ)
  "Numbers": "ኦሪት ዘኍልቊ",       // constants has ዘኍልቍ (different ቍ/ቊ)
  "Song of Solomon": "መኃልየ\u00a0መኃልይ ዘሰሎሞን", // PDF uses non-breaking space (U+00A0)
  "Baruch": "መጽሐፈ ባሮክ",        // constants has ትንቢተ ባሮክ
  "Joel": "ትንቢተ ኢዩኤል",        // constants has ኢዮኤል (different ዮ/ዩ)
};

/** Get the Amharic name as it appears in the PDF for a given book */
function pdfName(book: { name: string; amharicName: string }): string {
  return PDF_NAME_VARIANTS[book.name] || book.amharicName;
}

interface FormattedContent {
  sections: Array<{
    type: 'title' | 'poetry' | 'prose' | 'list' | 'footnote';
    title?: string;
    verses: Array<{
      verse_number: number;
      text: string;
      indent?: number; // For poetry
    }>;
    footnotes?: Array<{
      reference: string;
      text: string;
    }>;
  }>;
  metadata?: {
    hasPoetry: boolean;
    hasLists: boolean;
    hasFootnotes: boolean;
    verseCount: number;
  };
}

/**
 * Stage 1: Fast PDF Extraction using PyMuPDF
 */
function extractPdfText(): string {
  if (fs.existsSync(RAW_TEXT_FILE)) {
    console.log(`✅ Using existing raw text from ${RAW_TEXT_FILE}`);
    return fs.readFileSync(RAW_TEXT_FILE, 'utf-8');
  }

  if (!fs.existsSync(PDF_FILE)) {
    console.error(`❌ PDF file not found at ${PDF_FILE}`);
    process.exit(1);
  }

  console.log(`⏳ Extracting raw text from PDF... (Takes ~30 secs)`);
  try {
    const pythonScript = `
import sys
import fitz
doc = fitz.open('${PDF_FILE}')
text = []
for i in range(len(doc)):
    text.append(doc[i].get_text())
with open('${RAW_TEXT_FILE}', 'w', encoding='utf-8') as f:
    f.write('\\n'.join(text))
`;
    fs.writeFileSync('temp_extract.py', pythonScript);
    
    // Check if we need virtual environment
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';
    
    execSync(`${pythonCmd} temp_extract.py`, { stdio: 'inherit' });
    fs.unlinkSync('temp_extract.py');
    console.log(`✅ Raw text extracted to ${RAW_TEXT_FILE}`);
    return fs.readFileSync(RAW_TEXT_FILE, 'utf-8');
  } catch (error) {
    console.error(`❌ PDF Extraction failed:`, error);
    process.exit(1);
  }
}

/**
 * Get poetic/contextual clues for better Gemini parsing
 */
function getChapterContext(bookName: string, chapter: number): string {
  const contexts: Record<string, string> = {
    "Genesis:3": "Contains God's curses/judgments in verses 14-19 (poetic oracles)",
    "Genesis:49": "Jacob's blessing of his sons - entirely poetic",
    "Exodus:15": "Song of Moses - entirely poetic",
    "Exodus:20": "The Ten Commandments - structured list format",
    "Numbers:6": "Contains the Priestly Blessing (verses 24-26) - poetic",
    "Deuteronomy:32": "Song of Moses - entirely poetic",
    "Deuteronomy:33": "Moses' blessing - poetic",
    "2 Samuel:22": "David's song of deliverance - entirely poetic",
    "Job:3-42": "Most of Job is poetry/dialogue",
    "Psalms:1-150": "All Psalms are poetry",
    "Proverbs:1-31": "Most proverbs are poetry",
    "Song of Songs:1-8": "Entirely poetic",
    "Isaiah:1-66": "Primarily poetic prophecy",
    "Jeremiah:1-52": "Mix of prose and poetic oracles",
    "Lamentations:1-5": "Entirely poetic",
    "Ezekiel:1-48": "Mix of prose narrative and poetic oracles",
    "Daniel:1-12": "Mix of narrative and apocalyptic poetry",
  };

  const key = `${bookName}:${chapter}`;
  return contexts[key] || 'Standard narrative/prose format. Check for any embedded poetic passages, prayers, or formal speeches.';
}

/**
 * Stage 4: Gemini AI Structuring
 */
async function processChapterWithGemini(
  bookName: string,
  bookAmharicName: string,
  chapterNumber: number,
  rawContent: string
): Promise<FormattedContent> {
  const prompt = `You are restructuring a chapter from the Catholic Amharic Bible.

**Book:** ${bookAmharicName} (${bookName})
**Chapter:** ${chapterNumber}

**Raw Content:**
${rawContent}

**Your Task:**
Format this raw text into valid JSON with distinct sections (prose, poetry, lists).
Extract footers/footnotes and link them to verses. preserve standard Arabic verse numbers (1, 2, 3...).

**IMPORTANT CONTEXT:**
${getChapterContext(bookName, chapterNumber)}
`;

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-3-pro-preview',
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
                  title: { type: Type.STRING },
                  verses: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        verse_number: { type: Type.NUMBER },
                        text: { type: Type.STRING },
                        indent: { type: Type.NUMBER }
                      },
                      required: ['verse_number', 'text']
                    }
                  },
                  footnotes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        reference: { type: Type.STRING },
                        text: { type: Type.STRING }
                      },
                      required: ['reference', 'text']
                    }
                  }
                },
                required: ['type', 'verses']
              }
            },
            metadata: {
              type: Type.OBJECT,
              properties: {
                hasPoetry: { type: Type.BOOLEAN },
                hasLists: { type: Type.BOOLEAN },
                hasFootnotes: { type: Type.BOOLEAN },
                verseCount: { type: Type.NUMBER }
              }
            }
          },
          required: ['sections']
        },
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) throw new Error('No response from Gemini');
    return JSON.parse(text);
  } catch (error) {
    console.error(`❌ Gemini processing failed:`, error);
    throw error;
  }
}

/**
 * Main Pipeline
 */
async function runAgent(targetBookName?: string, dryRun: boolean = false) {
  console.log('\n' + '='.repeat(80));
  console.log('🤖 BIBLE EXTRACTION AGENT');
  console.log('='.repeat(80) + '\n');

  if (dryRun) console.log('⚠️ RUNNING IN DRY-RUN MODE (No DB Writes)\n');

  // Stage 1: Get raw text
  const text = extractPdfText();

  // Load books from DB
  const dbBooks = await db.select().from(books);
  if (dbBooks.length === 0) {
    console.warn('⚠️ No books found in DB. Did you run `pnpm db:seed`?');
    // We should really exit here, but we'll try to continue using CATHOLIC_BOOKS if needed
  }

  // Filter books to process
  const targetBooks = targetBookName 
    ? CATHOLIC_BOOKS.filter(b => b.name.toLowerCase() === targetBookName.toLowerCase())
    : CATHOLIC_BOOKS;

  if (targetBooks.length === 0) {
    console.error(`❌ Book "${targetBookName}" not found in Canon.`);
    process.exit(1);
  }

  // Find book positions in text — skip TOC entries by finding the occurrence
  // that is followed by chapter markers (ምዕራፍ)
  console.log('🔍 Identifying book boundaries...');

  /** Find the "content" start for a book — the occurrence nearest before ምዕራፍ 1 */
  function findBookContentStart(bookSearchName: string, afterPos: number = 0): number {
    // Find all occurrences of the book name
    let pos = afterPos;
    let bestPos = -1;
    while (true) {
      const idx = text.indexOf(bookSearchName, pos);
      if (idx === -1) break;
      // Check if ምዕራፍ appears within 2000 chars after this occurrence
      const nearbyText = text.substring(idx, idx + 2000);
      if (/ምዕራፍ\s+1\b/.test(nearbyText)) {
        bestPos = idx;
        break; // First one near a chapter marker is our best bet
      }
      pos = idx + 10;
      bestPos = idx; // Keep last found as fallback
    }
    return bestPos;
  }

  const bookPositions: Array<{ name: string; amharicName: string; startPos: number; endPos: number; chapters: number }> = [];

  for (let i = 0; i < CATHOLIC_BOOKS.length; i++) {
    const book = CATHOLIC_BOOKS[i];
    const searchName = pdfName(book);

    let startPos = findBookContentStart(searchName);
    if (startPos === -1) {
      console.log(`   ⚠️ "${searchName}" (${book.name}) not found in text`);
      continue;
    }

    let endPos = text.length;
    for (let j = i + 1; j < CATHOLIC_BOOKS.length; j++) {
      const nextSearchName = pdfName(CATHOLIC_BOOKS[j]);
      const pos = findBookContentStart(nextSearchName, startPos + 100);
      if (pos !== -1) {
        endPos = pos;
        break;
      }
    }

    bookPositions.push({
      name: book.name,
      amharicName: book.amharicName,
      chapters: book.chapters,
      startPos,
      endPos
    });
  }
  
  // Filter the positions to only process requested books
  const booksToProcess = targetBookName 
    ? bookPositions.filter(b => b.name.toLowerCase() === targetBookName.toLowerCase())
    : bookPositions;

  for (const bookPos of booksToProcess) {
    console.log(`\n📖 Processing Book: ${bookPos.amharicName} (${bookPos.name})`);
    
    // Get DB ID for this book
    const dbBook = dbBooks.find(b => b.name === bookPos.name);
    if (!dbBook && !dryRun) {
      console.error(`   ❌ Book ${bookPos.name} not found in database. Skipping.`);
      continue;
    }

    const bookText = text.substring(bookPos.startPos, bookPos.endPos);

    // Stage 3: Split into chapters - split by ምዕራፍ <number>
    // Deduplicate: keep only the FIRST occurrence of each chapter number
    const allMatches = [...bookText.matchAll(/ምዕራፍ\s+(\d+)/g)];
    const seenChapters = new Set<number>();
    const chapterMatches = allMatches.filter(m => {
      const num = parseInt(m[1]);
      if (num > bookPos.chapters || seenChapters.has(num)) return false;
      seenChapters.add(num);
      return true;
    });
    
    console.log(`   📊 Found ${chapterMatches.length}/${bookPos.chapters} chapters`);

    for (let i = 0; i < chapterMatches.length; i++) {
        const match = chapterMatches[i];
        const chapterNum = parseInt(match[1]);

        const startIdx = match.index!;
        const endIdx = (i + 1 < chapterMatches.length) ? chapterMatches[i + 1].index! : bookText.length;
        
        let chapterRawContent = bookText.substring(startIdx, endIdx).trim();
        chapterRawContent = chapterRawContent.replace(/^ምዕራፍ\s+\d+\s*/, '').trim();

        if (chapterRawContent.length < 10) {
            console.log(`   ⚠️ Chapter ${chapterNum} too short, skipping.`);
            continue;
        }

        if (!dryRun && dbBook) {
            // Check if already in DB
            const existing = await db
                .select({ id: chapterContents.id })
                .from(chapterContents)
                .where(
                    and(
                        eq(chapterContents.bookId, dbBook.id),
                        eq(chapterContents.chapterNumber, chapterNum)
                    )
                )
                .limit(1);

            if (existing.length > 0) {
                console.log(`   ⏭️ Chapter ${chapterNum} already in DB, skipping.`);
                continue;
            }
        }

        console.log(`   🤖 Structuring Chapter ${chapterNum} with Gemini...`);
        try {
            const formatted = await processChapterWithGemini(
                bookPos.name,
                bookPos.amharicName,
                chapterNum,
                chapterRawContent
            );

            console.log(`      ✅ Verses: ${formatted.metadata?.verseCount || '?'}, Poetry: ${formatted.metadata?.hasPoetry}`);

            if (!dryRun && dbBook) {
                await db.insert(chapterContents).values({
                    bookId: dbBook.id,
                    chapterNumber: chapterNum,
                    content: formatted as any, // Store structured JSON
                    style: formatted.metadata?.hasPoetry ? 'mixed' : 'prose',
                    verified: 0,
                });
                console.log(`      💾 Saved to DB`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
            console.error(`      ❌ Failed on Chapter ${chapterNum}:`, e);
        }
    }
  }

  console.log('\n✅ Agent processing complete!\n');
}

// CLI args parser
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const bookArg = args.find(a => a.startsWith('--book='));
const targetBookName = bookArg ? bookArg.split('=')[1].replace(/_/g, ' ') : undefined;

runAgent(targetBookName, isDryRun).then(() => {
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
