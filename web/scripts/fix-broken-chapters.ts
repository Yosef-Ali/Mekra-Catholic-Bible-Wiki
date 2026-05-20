/**
 * Fix chapters with wrong/empty content caused by the PDF extraction off-by-one bug.
 *
 * Strategy:
 *  1. Use PyMuPDF (extract-layout.py) to get correct raw text from the PDF pages
 *  2. Use the Node.js Gemini SDK (which works, unlike Python requests) to structure it
 *  3. Directly update the DB with the corrected content
 *
 * Books affected:
 *   Lamentations (pages 457-459), Baruch (pages 460-463)
 *   Obadiah (page 508), Jonah (pages 509-510)
 *   Philemon (page 651), Hebrews (pages 652-657)
 *   Jude (page 670), Proverbs Ch 18 (pages 358-371)
 */

import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import { execSync } from 'child_process';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const apiKey = process.env.GEMINI_API_KEY!;
const ai = new GoogleGenAI({ apiKey });

const SYSTEM_PROMPT = `You are an Amharic Bible text structurer. You receive pre-extracted text from a scanned Bible PDF.

The text uses layout markers:
  [TITLE]  = Book title or major heading
  [HEAD]   = Chapter heading (ምዕራፍ N) or section heading
  [VERSE]  = Regular verse/prose text
  [POETRY] = Indented/poetry text
  [PARA]   = Paragraph break signal
  [PAGE N] = Page boundary

Rules:
1. PRESERVE every Amharic character exactly
2. Identify chapter numbers from [HEAD] lines containing "ምዕራፍ N" (N is Ethiopic or Arabic numeral)
3. Extract verse numbers from inline numbers at start of verse text
4. Mark type="poetry" for lines from [POETRY] blocks
5. Mark is_new_paragraph=true when [PARA] precedes a verse
6. SKIP footnotes, cross-references, and introductory text before chapter 1
7. Return ALL chapters found in the text`;

interface RawVerse {
  verse_number: number;
  text: string;
  is_new_paragraph?: boolean;
  indent?: number;
}

interface RawSection {
  type: 'prose' | 'poetry';
  subtitle_text?: string;
  verses: RawVerse[];
}

interface RawChapter {
  chapter_number: number;
  sections: RawSection[];
}

function extractLayoutText(startPage: number, endPage: number, bookName: string): string {
  const cmd = `python3 scripts/extract-layout.py ${startPage} ${endPage} "${bookName}"`;
  const output = execSync(cmd, { cwd: process.cwd(), maxBuffer: 50 * 1024 * 1024, timeout: 60000 });
  const result = JSON.parse(output.toString());
  return result.full_enriched as string;
}

async function structureWithNodeGemini(enrichedText: string, bookName: string): Promise<RawChapter[]> {
  const prompt = `${SYSTEM_PROMPT}

Structure the following text from ${bookName} into chapters and verses.

EXTRACTED TEXT:
${enrichedText}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    chapter_number: { type: Type.NUMBER },
                    sections: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          type: { type: Type.STRING },
                          subtitle_text: { type: Type.STRING },
                          verses: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                verse_number: { type: Type.NUMBER },
                                text: { type: Type.STRING },
                                is_new_paragraph: { type: Type.BOOLEAN },
                                indent: { type: Type.NUMBER },
                              },
                              required: ['verse_number', 'text'],
                            }
                          }
                        },
                        required: ['type', 'verses']
                      }
                    }
                  },
                  required: ['chapter_number', 'sections']
                }
              }
            },
            required: ['chapters']
          },
          temperature: 0,
        }
      });
      const text = response.text;
      if (!text) throw new Error('Empty response');
      const parsed = JSON.parse(text);
      return parsed.chapters || [];
    } catch (err: any) {
      console.error(`  ⚠️ Attempt ${attempt}/3 failed: ${err.message?.substring(0, 100)}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 5000));
    }
  }
  return [];
}

function convertToDbFormat(chapters: RawChapter[]): { bookContent: any; paragraphBreaks: number[] } {
  // Convert a single chapter's sections to DB format
  // (This function operates on one chapter for per-chapter DB update)
  throw new Error('Use convertChapterToDb instead');
}

function convertChapterToDb(chapter: RawChapter): { content: any; formattingRules: any } {
  const sections = chapter.sections.map(s => ({
    type: s.type || 'prose',
    title: s.subtitle_text || undefined,
    verses: (s.verses || []).map(v => ({
      verse_number: v.verse_number,
      text: v.text,
      indent: v.indent || 0,
    }))
  }));

  const paragraphBreaks: number[] = [];
  let hasPoetry = false;

  for (const section of sections) {
    if (section.type === 'poetry') hasPoetry = true;
    if (section.verses.length > 0) {
      const firstVerse = section.verses[0].verse_number;
      if (firstVerse > 0 && !paragraphBreaks.includes(firstVerse)) {
        paragraphBreaks.push(firstVerse);
      }
    }
  }
  paragraphBreaks.sort((a, b) => a - b);

  const totalVerses = sections.reduce((sum, s) => sum + s.verses.length, 0);

  return {
    content: {
      sections,
      metadata: {
        hasPoetry,
        hasLists: false,
        hasFootnotes: false,
        verseCount: totalVerses,
      }
    },
    formattingRules: {
      paragraphBreaks,
      hasPoetry,
      hasLists: false,
      hasFootnotes: false,
    }
  };
}

const PAGES_PER_CHUNK = 5; // Keep requests under ~20KB

async function fixBook(bookName: string, startPage: number, endPage: number) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📖 Fixing ${bookName} (PDF pages ${startPage}–${endPage})`);

  // Get book ID from DB
  const [book] = await sql`SELECT id, name, amharic_name FROM books WHERE name = ${bookName}`;
  if (!book) {
    console.error(`  ❌ Book "${bookName}" not found in DB`);
    return;
  }

  // Get existing chapters for this book
  const existingChapters = await sql`
    SELECT chapter_number FROM formatted_chapter_contents
    WHERE book_id = ${book.id}
    ORDER BY chapter_number
  `;
  const existingNums = new Set(existingChapters.map((c: any) => c.chapter_number));

  // Split into page chunks to keep Gemini request sizes small
  const totalPages = endPage - startPage + 1;
  const numChunks = Math.ceil(totalPages / PAGES_PER_CHUNK);

  const allChapters: RawChapter[] = [];
  const seenChapterNums = new Set<number>();

  for (let chunk = 0; chunk < numChunks; chunk++) {
    const chunkStart = startPage + chunk * PAGES_PER_CHUNK;
    const chunkEnd = Math.min(endPage, chunkStart + PAGES_PER_CHUNK - 1);
    console.log(`  📄 Chunk ${chunk + 1}/${numChunks}: pages ${chunkStart}–${chunkEnd}`);

    const enrichedText = extractLayoutText(chunkStart, chunkEnd, bookName);
    console.log(`     → ${Math.round(enrichedText.length / 1024)}KB`);

    console.log(`     🤖 Structuring with Gemini...`);
    const chapters = await structureWithNodeGemini(enrichedText, bookName);

    for (const ch of chapters) {
      if (!seenChapterNums.has(ch.chapter_number)) {
        allChapters.push(ch);
        seenChapterNums.add(ch.chapter_number);
      }
    }
    console.log(`     → Found: ${chapters.map(c => c.chapter_number).join(', ')}`);

    if (chunk < numChunks - 1) await new Promise(r => setTimeout(r, 2000));
  }

  const chapters = allChapters;
  console.log(`\n  📊 Total: ${chapters.length} chapter(s): ${chapters.map(c => c.chapter_number).join(', ')}`);

  if (chapters.length === 0) {
    console.error(`  ❌ No chapters extracted!`);
    return;
  }

  // Update each chapter in DB
  let updated = 0;
  for (const chapter of chapters) {
    if (!existingNums.has(chapter.chapter_number)) {
      console.log(`  ⏭️  Ch ${chapter.chapter_number} not in DB, skipping`);
      continue;
    }

    const { content, formattingRules } = convertChapterToDb(chapter);
    const totalVerses = content.sections.reduce((sum: number, s: any) => sum + s.verses.length, 0);

    await sql`
      UPDATE formatted_chapter_contents
      SET
        content = ${JSON.stringify(content)}::jsonb,
        formatting_rules = ${JSON.stringify(formattingRules)}::jsonb,
        verified = 1,
        updated_at = NOW()
      WHERE book_id = ${book.id} AND chapter_number = ${chapter.chapter_number}
    `;

    console.log(`  ✅ Ch ${chapter.chapter_number}: ${totalVerses} verses, poetry=${content.metadata.hasPoetry}`);
    updated++;
  }
  console.log(`  💾 Updated ${updated} chapter(s)`);
}

// ─── Books to fix ─────────────────────────────────────────────────────────────
const BOOKS_TO_FIX: Array<{ name: string; startPage: number; endPage: number }> = [
  { name: 'Lamentations', startPage: 457, endPage: 459 },
  { name: 'Baruch',       startPage: 460, endPage: 463 },
  { name: 'Obadiah',      startPage: 508, endPage: 508 },
  { name: 'Jonah',        startPage: 509, endPage: 510 },
  { name: 'Philemon',     startPage: 651, endPage: 651 },
  { name: 'Hebrews',      startPage: 652, endPage: 657 },
  { name: 'Jude',         startPage: 670, endPage: 670 },
  { name: 'Proverbs',     startPage: 358, endPage: 371 },
];

async function main() {
  const args = process.argv.slice(2);
  const targetBook = args[0]; // Optional: fix only one book

  const toFix = targetBook
    ? BOOKS_TO_FIX.filter(b => b.name.toLowerCase() === targetBook.toLowerCase())
    : BOOKS_TO_FIX;

  if (toFix.length === 0) {
    console.error(`Book "${targetBook}" not in fix list`);
    process.exit(1);
  }

  console.log(`\n🔧 Fixing ${toFix.length} book(s) with wrong/missing content\n`);

  for (const book of toFix) {
    try {
      await fixBook(book.name, book.startPage, book.endPage);
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`❌ Failed: ${book.name}: ${err.message}`);
    }
  }

  console.log('\n✅ Done! Run pnpm quality:check to verify.');
}

main().catch(console.error);
