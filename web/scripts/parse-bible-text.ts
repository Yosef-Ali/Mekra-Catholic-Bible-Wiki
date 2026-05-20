import fs from 'fs';
import { CATHOLIC_BOOKS } from '../constants';

/**
 * Parse the extracted Bible text into structured format
 * Input: amharic_bible_extracted.txt (raw PDF text)
 * Output: JSON files for each book with chapters and verses
 */

interface ParsedVerse {
  verseNumber: number;
  text: string;
}

interface ParsedChapter {
  chapterNumber: number;
  content: string; // Full text with [verse] numbers
  verses: ParsedVerse[];
}

interface ParsedBook {
  bookName: string;
  amharicName: string;
  chapters: ParsedChapter[];
}

/**
 * Extract text between two positions
 */
function extractSection(text: string, startPos: number, endPos: number): string {
  if (endPos === -1) {
    return text.substring(startPos);
  }
  return text.substring(startPos, endPos);
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

  return -1;
}

/**
 * Parse a chapter's verses from text
 */
function parseVerses(chapterText: string): { content: string; verses: ParsedVerse[] } {
  const verses: ParsedVerse[] = [];

  // Check if text has verse numbers in brackets [1], [2], etc.
  const hasVerseNumbers = /\[(\d+)\]/.test(chapterText);

  if (!hasVerseNumbers) {
    // No verse numbers found, return as-is
    return {
      content: chapterText.trim(),
      verses: [{ verseNumber: 1, text: chapterText.trim() }]
    };
  }

  // Split by verse numbers
  const parts = chapterText.split(/\[(\d+)\]/);
  let content = '';

  // Handle intro text if exists
  if (parts[0] && parts[0].trim()) {
    content += parts[0].trim() + ' ';
  }

  // Parse verses
  for (let i = 1; i < parts.length; i += 2) {
    const verseNum = parseInt(parts[i]);
    const verseText = parts[i + 1];

    if (!isNaN(verseNum) && verseText) {
      verses.push({
        verseNumber: verseNum,
        text: verseText.trim()
      });
      content += `[${verseNum}] ${verseText.trim()} `;
    }
  }

  return {
    content: content.trim(),
    verses
  };
}

/**
 * Split book text into chapters
 * This is tricky - we need to detect chapter breaks
 * Looking for patterns like "ምእራፍ 2" or numbered sections
 */
function splitIntoChapters(bookText: string, expectedChapters: number): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];

  // Strategy 1: Look for "ምእራፍ" (chapter) markers
  const chapterMarkers = bookText.match(/ምእራፍ\s+(\d+)/g);

  if (chapterMarkers && chapterMarkers.length >= expectedChapters - 1) {
    // Use chapter markers to split
    let currentPos = 0;

    for (let i = 1; i <= expectedChapters; i++) {
      const nextMarker = i < expectedChapters ? `ምእራፍ ${i + 1}` : null;
      const nextPos = nextMarker ? bookText.indexOf(nextMarker, currentPos) : bookText.length;

      const chapterText = bookText.substring(currentPos, nextPos === -1 ? bookText.length : nextPos);
      const { content, verses } = parseVerses(chapterText);

      chapters.push({
        chapterNumber: i,
        content,
        verses
      });

      currentPos = nextPos;
    }
  } else {
    // Fallback: Split based on verse number resets
    // When we see [1] again, it's likely a new chapter
    const verseOnes = [...bookText.matchAll(/\[1\]/g)];

    if (verseOnes.length >= expectedChapters) {
      for (let i = 0; i < expectedChapters; i++) {
        const startPos = verseOnes[i].index || 0;
        const endPos = i < expectedChapters - 1 ? verseOnes[i + 1].index : bookText.length;

        const chapterText = bookText.substring(startPos, endPos);
        const { content, verses } = parseVerses(chapterText);

        chapters.push({
          chapterNumber: i + 1,
          content,
          verses
        });
      }
    } else {
      // Last resort: treat entire book as one chapter (for single-chapter books)
      const { content, verses } = parseVerses(bookText);
      chapters.push({
        chapterNumber: 1,
        content,
        verses
      });
    }
  }

  return chapters;
}

/**
 * Main parsing function
 */
async function parseBibleText(inputFile: string, outputDir: string = './output/parsed') {
  console.log('📖 Starting Bible text parsing...\n');
  console.log(`📄 Input: ${inputFile}`);
  console.log(`💾 Output: ${outputDir}\n`);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Read the full extracted text
  const fullText = fs.readFileSync(inputFile, 'utf-8');
  console.log(`✅ Loaded text file: ${fullText.length.toLocaleString()} characters\n`);

  const parsedBooks: ParsedBook[] = [];
  let successCount = 0;
  let failCount = 0;

  // Process each book
  for (let i = 0; i < CATHOLIC_BOOKS.length; i++) {
    const book = CATHOLIC_BOOKS[i];
    console.log(`[${i + 1}/${CATHOLIC_BOOKS.length}] Processing: ${book.amharicName} (${book.name})...`);

    try {
      // Find book start position
      const bookStart = findBookPosition(fullText, book.amharicName);

      if (bookStart === -1) {
        console.log(`   ⚠️  Book title not found in text, skipping...`);
        failCount++;
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

      // Split into chapters
      const chapters = splitIntoChapters(bookText, book.chapters);

      if (chapters.length === 0) {
        console.log(`   ⚠️  No chapters extracted, skipping...`);
        failCount++;
        continue;
      }

      const parsedBook: ParsedBook = {
        bookName: book.name,
        amharicName: book.amharicName,
        chapters
      };

      parsedBooks.push(parsedBook);

      // Save individual book file
      const bookOutputPath = `${outputDir}/${book.name.replace(/\s+/g, '_').toLowerCase()}.json`;
      fs.writeFileSync(bookOutputPath, JSON.stringify(parsedBook, null, 2), 'utf-8');

      console.log(`   ✅ Extracted ${chapters.length} chapter(s) → ${bookOutputPath}`);
      successCount++;

    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      failCount++;
    }
  }

  // Save combined file
  const combinedPath = `${outputDir}/all_books.json`;
  fs.writeFileSync(combinedPath, JSON.stringify(parsedBooks, null, 2), 'utf-8');

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 PARSING SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Successfully parsed: ${successCount} books`);
  console.log(`❌ Failed to parse: ${failCount} books`);
  console.log(`📁 Total output files: ${successCount + 1}`);
  console.log(`💾 Combined file: ${combinedPath}`);
  console.log('='.repeat(80));
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
📖 Bible Text Parser

USAGE:
  pnpm parse:bible <input_file> [output_directory]

EXAMPLE:
  pnpm parse:bible amharic_bible_extracted.txt ./output/parsed

OUTPUT:
  - Individual JSON files for each book
  - Combined all_books.json with all books
    `);
    process.exit(1);
  }

  const [inputFile, outputDir = './output/parsed'] = args;

  try {
    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`);
    }

    await parseBibleText(inputFile, outputDir);

    console.log('\n✅ Parsing complete! Review the output files before seeding to database.');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseBibleText, parseVerses, splitIntoChapters };
