import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * PDF Content Extractor and Proofreader
 *
 * This script:
 * 1. Extracts text from PDF files
 * 2. Uses Gemini Pro to proofread and structure the content
 * 3. Formats it with proper verse numbers and structure
 * 4. Saves the processed content for database seeding
 */

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface BookContent {
  bookName: string;
  amharicName: string;
  chapters: ChapterContent[];
}

/**
 * Read PDF file and convert to base64 for Gemini
 */
function readPdfAsBase64(pdfPath: string): string {
  const pdfBuffer = fs.readFileSync(pdfPath);
  return pdfBuffer.toString('base64');
}

/**
 * Extract and structure content from PDF using Gemini Pro
 */
async function extractPdfContent(pdfPath: string): Promise<string> {
  try {
    console.log(`📖 Reading PDF: ${pdfPath}`);
    const pdfBase64 = readPdfAsBase64(pdfPath);

    console.log('🤖 Sending to Gemini Pro for extraction...');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64
              }
            },
            {
              text: `Extract all text content from this PDF document.

              IMPORTANT INSTRUCTIONS:
              1. Extract ALL text exactly as it appears
              2. Preserve paragraph breaks and structure
              3. Maintain any chapter/verse numbers if present
              4. Keep Amharic text intact
              5. Do not add any commentary or explanations
              6. Return ONLY the extracted text content

              If this is a Bible book, try to identify:
              - Book name (English and Amharic)
              - Chapter divisions
              - Verse numbers

              Return the raw extracted text.`
            }
          ]
        }
      ]
    });

    const extractedText = response.text || '';
    console.log('✅ Content extracted successfully');
    return extractedText;

  } catch (error) {
    console.error('❌ Error extracting PDF content:', error);
    throw error;
  }
}

interface RichSegment {
  type: 'verse' | 'subtitle' | 'poetry' | 'heading';
  number?: number; // For verses
  text?: string; // For verses, subtitles, headings
  lines?: string[]; // For poetry
  level?: number; // For headings
}

interface ChapterContent {
  chapterNumber: number;
  segments: RichSegment[];
}



/**
 * Use Gemini Pro to proofread and structure the extracted content
 */
async function proofreadAndStructure(
  extractedText: string,
  bookName: string,
  amharicName: string,
  chapterNumber: number
): Promise<ChapterContent> {
  try {
    console.log(`\n📝 Proofreading ${bookName} Chapter ${chapterNumber} with Gemini Pro...`);

    const prompt = `You are a biblical text proofreader and formatter for the Catholic Amharic Bible.

TASK: Proofread and structure the following extracted text from ${bookName} (${amharicName}) Chapter ${chapterNumber}.

REQUIREMENTS:
1.  **Identify Structure**: Break the text into a list of segments.
2.  **Verses**: Standard verses. Use "type": "verse".
3.  **Subtitles**: Titles that appear *within* the text (e.g., "The Creation of Man"). Use "type": "subtitle".
4.  **Poetry**: Sections that are formatted as poetry (short lines, indentation). Use "type": "poetry" and provide a list of "lines".
5.  **Headings**: Major section headings. Use "type": "heading".
6.  **Preserve Amharic**: Keep all Amharic text exactly as is.
7.  **No Commentary**: Do not add explanations.

OUTPUT FORMAT (strict JSON):
{
  "chapterNumber": ${chapterNumber},
  "segments": [
    { "type": "heading", "level": 1, "text": "The Creation" },
    { "type": "verse", "number": 1, "text": "In the beginning..." },
    { "type": "subtitle", "text": "The First Day" },
    { "type": "poetry", "lines": ["The earth was formless", "and void..."] },
    { "type": "verse", "number": 2, "text": "..." }
  ]
}

EXTRACTED TEXT:
---
${extractedText}
---

Return ONLY valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.1, // Low temperature for accuracy
        responseMimeType: "application/json"
      }
    });

    let text = response.text || '';

    // Clean up JSON response
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
      text = text.substring(startIndex, endIndex + 1);
    }

    const structured = JSON.parse(text) as ChapterContent;

    console.log(`✅ Proofread complete: ${structured.segments.length} segments processed`);
    return structured;

  } catch (error) {
    console.error('❌ Error proofreading content:', error);
    throw error;
  }
}

/**
 * Save processed content to JSON file
 */
function saveProcessedContent(
  bookContent: BookContent,
  outputDir: string
): void {
  const fileName = `${bookContent.bookName.toLowerCase().replace(/\s+/g, '_')}.json`;
  const outputPath = path.join(outputDir, fileName);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(bookContent, null, 2), 'utf-8');
  console.log(`\n💾 Saved processed content to: ${outputPath}`);
}

/**
 * Save in database-ready format
 */
function saveForDatabaseSeed(
  bookContent: BookContent,
  outputDir: string
): void {
  const seedDir = path.join(outputDir, 'seed');
  if (!fs.existsSync(seedDir)) {
    fs.mkdirSync(seedDir, { recursive: true });
  }

  // Create SQL insert statements
  const sqlStatements: string[] = [];

  bookContent.chapters.forEach(chapter => {
    // Serialize the segments to JSON string
    const contentJson = JSON.stringify(chapter.segments);

    sqlStatements.push(
      `-- ${bookContent.bookName} Chapter ${chapter.chapterNumber}\n` +
      `INSERT INTO chapter_contents (book_id, chapter_number, content, style, verified) VALUES (\n` +
      `  (SELECT id FROM books WHERE name = '${bookContent.bookName}'),\n` +
      `  ${chapter.chapterNumber},\n` +
      `  '${contentJson.replace(/'/g, "''")}',\n` +
      `  'rich',\n` +
      `  1\n` +
      `);\n`
    );
  });

  const sqlFile = path.join(seedDir, `${bookContent.bookName.toLowerCase().replace(/\s+/g, '_')}.sql`);
  fs.writeFileSync(sqlFile, sqlStatements.join('\n'), 'utf-8');
  console.log(`📊 Saved SQL seed file to: ${sqlFile}`);
}

/**
 * Main processing function
 */
async function processPdfBook(
  pdfPath: string,
  bookName: string,
  amharicName: string,
  startChapter: number = 1,
  endChapter: number = 1
): Promise<BookContent> {
  console.log('\n' + '='.repeat(60));
  console.log(`📚 Processing: ${bookName} (${amharicName})`);
  console.log(`📄 PDF: ${pdfPath}`);
  console.log(`📖 Chapters: ${startChapter} to ${endChapter}`);
  console.log('='.repeat(60));

  // Extract raw text from PDF
  const extractedText = await extractPdfContent(pdfPath);

  // For now, we'll process the entire extracted text as one chapter
  // You can enhance this to split by chapters if the PDF has multiple
  const chapters: ChapterContent[] = [];

  // If the PDF contains multiple chapters, you'd need to split here
  // For single chapter processing:
  const chapterContent = await proofreadAndStructure(
    extractedText,
    bookName,
    amharicName,
    startChapter
  );

  chapters.push(chapterContent);

  const bookContent: BookContent = {
    bookName,
    amharicName,
    chapters
  };

  return bookContent;
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log(`
📖 PDF Bible Content Extractor & Proofreader

USAGE:
  pnpm tsx scripts/pdf-extractor.ts <pdf_path> <book_name> <amharic_name> [chapter]

EXAMPLES:
  pnpm tsx scripts/pdf-extractor.ts ./books/genesis.pdf "Genesis" "ኦሪት ዘፍጥረት" 1
  pnpm tsx scripts/pdf-extractor.ts ./books/matthew.pdf "Matthew" "የማቴዎስ ወንጌል" 1

OPTIONS:
  pdf_path      - Path to the PDF file
  book_name     - English name of the book
  amharic_name  - Amharic name of the book
  chapter       - Chapter number (default: 1)

OUTPUT:
  - Processed JSON in ./output/processed/
  - SQL seed files in ./output/seed/
    `);
    process.exit(1);
  }

  const [pdfPath, bookName, amharicName, chapterStr = '1'] = args;
  const chapter = parseInt(chapterStr);

  try {
    // Process the PDF
    const bookContent = await processPdfBook(
      pdfPath,
      bookName,
      amharicName,
      chapter,
      chapter
    );

    // Save outputs
    const outputDir = './output/processed';
    saveProcessedContent(bookContent, outputDir);
    saveForDatabaseSeed(bookContent, './output');

    console.log('\n' + '='.repeat(60));
    console.log('✅ PROCESSING COMPLETE!');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Book: ${bookContent.bookName} (${bookContent.amharicName})`);
    console.log(`   Chapters: ${bookContent.chapters.length}`);
    console.log(`   Total Segments: ${bookContent.chapters.reduce((sum, ch) => sum + ch.segments.length, 0)}`);
    console.log(`\n📁 Output Files:`);
    console.log(`   - JSON: ./output/processed/${bookContent.bookName.toLowerCase().replace(/\s+/g, '_')}.json`);
    console.log(`   - SQL:  ./output/seed/${bookContent.bookName.toLowerCase().replace(/\s+/g, '_')}.sql`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Review the processed content');
    console.log('   2. Verify verse accuracy');
    console.log('   3. Run the SQL seed file to add to database');
    console.log('');

  } catch (error) {
    console.error('\n❌ Processing failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { processPdfBook, proofreadAndStructure, extractPdfContent };
