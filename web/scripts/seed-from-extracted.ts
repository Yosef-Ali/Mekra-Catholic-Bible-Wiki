import fs from 'fs';
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and } from 'drizzle-orm';
import { CATHOLIC_BOOKS } from '../constants';

/**
 * Seed chapters from the extracted Bible text file
 * Faster and more accurate than AI generation
 * Uses the amharic_bible_extracted.txt file
 */

interface SeedStats {
  booksProcessed: number;
  chaptersSeeded: number;
  chaptersSkipped: number;
  chaptersFailed: number;
  totalExpected: number;
}

/**
 * Find the position of a book title in the text
 */
function findBookPosition(text: string, amharicName: string): number {
  // Try exact match first
  let pos = text.indexOf(amharicName);
  if (pos !== -1) return pos;

  // Try with newlines
  pos = text.indexOf(`\n${amharicName}\n`);
  if (pos !== -1) return pos + 1;

  // Try with "ኦሪት" prefix for Torah books
  if (amharicName.startsWith('ኦሪት')) {
    pos = text.indexOf(amharicName);
    if (pos !== -1) return pos;
  }

  return -1;
}

/**
 * Extract text section between two positions
 */
function extractSection(text: string, startPos: number, endPos: number): string {
  if (endPos === -1) {
    return text.substring(startPos);
  }
  return text.substring(startPos, endPos);
}

/**
 * Parse verses from chapter text
 */
function parseChapterContent(chapterText: string): string {
  // Clean up and preserve verse numbers in [n] format
  const lines = chapterText.split('\n');
  let content = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed) {
      content += trimmed + ' ';
    }
  }

  return content.trim();
}

/**
 * Split book text into chapters
 */
function splitIntoChapters(bookText: string, expectedChapters: number): string[] {
  const chapters: string[] = [];

  // Strategy 1: Look for "ምእራፍ" (chapter) markers
  const chapterPattern = /ምእራፍ\s+(\d+)/g;
  const chapterMarkers: Array<{ chapter: number; index: number }> = [];

  let match;
  while ((match = chapterPattern.exec(bookText)) !== null) {
    chapterMarkers.push({
      chapter: parseInt(match[1]),
      index: match.index
    });
  }

  // If we found chapter markers
  if (chapterMarkers.length >= expectedChapters - 1) {
    for (let i = 1; i <= expectedChapters; i++) {
      const currentMarker = chapterMarkers.find(m => m.chapter === i);
      const nextMarker = chapterMarkers.find(m => m.chapter === i + 1);

      if (currentMarker) {
        const startPos = currentMarker.index;
        const endPos = nextMarker ? nextMarker.index : bookText.length;
        const chapterText = bookText.substring(startPos, endPos);
        chapters.push(parseChapterContent(chapterText));
      } else {
        // Fallback: create empty chapter
        chapters.push('');
      }
    }
  } else {
    // Strategy 2: Look for verse [1] resets
    const verseOnePattern = /\[1\]/g;
    const verseOnes: number[] = [];

    while ((match = verseOnePattern.exec(bookText)) !== null) {
      verseOnes.push(match.index);
    }

    if (verseOnes.length >= expectedChapters) {
      for (let i = 0; i < expectedChapters; i++) {
        const startPos = verseOnes[i];
        const endPos = i < expectedChapters - 1 ? verseOnes[i + 1] : bookText.length;
        const chapterText = bookText.substring(startPos, endPos);
        chapters.push(parseChapterContent(chapterText));
      }
    } else {
      // Strategy 3: Estimate based on text length
      const avgChapterLength = Math.floor(bookText.length / expectedChapters);

      for (let i = 0; i < expectedChapters; i++) {
        const startPos = i * avgChapterLength;
        const endPos = Math.min((i + 1) * avgChapterLength, bookText.length);
        const chapterText = bookText.substring(startPos, endPos);
        chapters.push(parseChapterContent(chapterText));
      }
    }
  }

  return chapters;
}

/**
 * Main seeding function
 */
async function seedFromExtracted(extractedFilePath: string, skipExisting: boolean = true) {
  console.log('📖 Seeding Bible from extracted text...\n');
  console.log(`📄 Reading: ${extractedFilePath}\n`);

  const stats: SeedStats = {
    booksProcessed: 0,
    chaptersSeeded: 0,
    chaptersSkipped: 0,
    chaptersFailed: 0,
    totalExpected: CATHOLIC_BOOKS.reduce((sum, book) => sum + book.chapters, 0)
  };

  try {
    // Read the full extracted text
    const fullText = fs.readFileSync(extractedFilePath, 'utf-8');
    console.log(`✅ Loaded ${fullText.length.toLocaleString()} characters\n`);

    // Get all books from database to get their IDs
    const dbBooks = await db.select().from(books).orderBy(books.id);
    const bookIdMap = new Map(dbBooks.map(b => [b.name, b.id!]));

    console.log('='.repeat(80));
    console.log(`📚 Processing ${CATHOLIC_BOOKS.length} books`);
    console.log(`📄 Expected total chapters: ${stats.totalExpected}`);
    console.log('='.repeat(80));

    // Process each book
    for (let i = 0; i < CATHOLIC_BOOKS.length; i++) {
      const book = CATHOLIC_BOOKS[i];
      const bookId = bookIdMap.get(book.name);

      if (!bookId) {
        console.log(`\n❌ Book not found in database: ${book.name}`);
        stats.chaptersFailed += book.chapters;
        continue;
      }

      console.log(`\n[${i + 1}/${CATHOLIC_BOOKS.length}] ${book.amharicName} (${book.name})`);
      console.log(`   Chapters: ${book.chapters}`);

      // Find book position in text
      const bookStart = findBookPosition(fullText, book.amharicName);

      if (bookStart === -1) {
        console.log(`   ⚠️  Book title not found in extracted text, skipping...`);
        stats.chaptersFailed += book.chapters;
        continue;
      }

      // Find next book start (or end of file)
      let bookEnd = -1;
      if (i < CATHOLIC_BOOKS.length - 1) {
        const nextBook = CATHOLIC_BOOKS[i + 1];
        bookEnd = findBookPosition(fullText, nextBook.amharicName);
      }

      // Extract book text
      const bookText = extractSection(fullText, bookStart, bookEnd);
      console.log(`   📏 Extracted ${bookText.length.toLocaleString()} characters`);

      // Split into chapters
      const chapterTexts = splitIntoChapters(bookText, book.chapters);
      console.log(`   📑 Split into ${chapterTexts.length} chapters`);

      // Seed each chapter
      for (let chapterNum = 1; chapterNum <= book.chapters; chapterNum++) {
        try {
          // Check if exists
          if (skipExisting) {
            const existing = await db.select()
              .from(chapterContents)
              .where(and(
                eq(chapterContents.bookId, bookId),
                eq(chapterContents.chapterNumber, chapterNum)
              ))
              .limit(1);

            if (existing.length > 0) {
              stats.chaptersSkipped++;
              continue;
            }
          }

          // Get chapter content
          const content = chapterTexts[chapterNum - 1] || '';

          if (!content || content.length < 10) {
            console.log(`   ⚠️  Chapter ${chapterNum}: No content found`);
            stats.chaptersFailed++;
            continue;
          }

          // Insert to database
          await db.insert(chapterContents).values({
            bookId,
            chapterNumber: chapterNum,
            content,
            verified: 0, // Mark as unverified since it's from OCR/extraction
          });

          stats.chaptersSeeded++;

        } catch (error) {
          console.log(`   ❌ Chapter ${chapterNum} failed: ${error instanceof Error ? error.message : String(error)}`);
          stats.chaptersFailed++;
        }
      }

      stats.booksProcessed++;
      console.log(`   ✅ Completed: ${stats.chaptersSeeded} seeded, ${stats.chaptersSkipped} skipped, ${stats.chaptersFailed} failed`);
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SEEDING COMPLETE');
    console.log('='.repeat(80));
    console.log(`📚 Books processed: ${stats.booksProcessed}/${CATHOLIC_BOOKS.length}`);
    console.log(`✅ Chapters seeded: ${stats.chaptersSeeded}`);
    console.log(`⏭️  Chapters skipped (existing): ${stats.chaptersSkipped}`);
    console.log(`❌ Chapters failed: ${stats.chaptersFailed}`);
    console.log(`📊 Total: ${stats.chaptersSeeded + stats.chaptersSkipped + stats.chaptersFailed}/${stats.totalExpected}`);
    console.log('='.repeat(80));

    if (stats.chaptersFailed > 0) {
      console.log('\n⚠️  Some chapters failed. You may need to:');
      console.log('   1. Check the extracted text format');
      console.log('   2. Manually verify book titles match CATHOLIC_BOOKS');
      console.log('   3. Use AI generation for missing chapters');
    }

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
📖 Seed Bible from Extracted Text

USAGE:
  pnpm tsx scripts/seed-from-extracted.ts <extracted_file> [--overwrite]

EXAMPLES:
  pnpm tsx scripts/seed-from-extracted.ts amharic_bible_extracted.txt
  pnpm tsx scripts/seed-from-extracted.ts amharic_bible_extracted.txt --overwrite

OPTIONS:
  --overwrite    Overwrite existing chapters (default: skip existing)

NOTES:
  - Much faster than AI generation (seconds vs hours)
  - Uses the pre-extracted Bible text file
  - Marks chapters as unverified (verified=0) for later review
  - Can be run multiple times safely (skips existing by default)
    `);
    process.exit(1);
  }

  const extractedFile = args[0];
  const skipExisting = !args.includes('--overwrite');

  if (!fs.existsSync(extractedFile)) {
    console.error(`\n❌ Error: File not found: ${extractedFile}`);
    process.exit(1);
  }

  console.log('\n📖 Starting Bible seeding from extracted text...');
  if (skipExisting) {
    console.log('⏭️  Will skip existing chapters\n');
  } else {
    console.log('⚠️  Will overwrite existing chapters\n');
  }

  try {
    await seedFromExtracted(extractedFile, skipExisting);
    console.log('\n✅ Seeding complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: pnpm db:studio');
    console.log('   2. Review seeded chapters');
    console.log('   3. Mark verified chapters with verified=1');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

export { seedFromExtracted };

// Always run main when this file is executed
main().catch(console.error);
