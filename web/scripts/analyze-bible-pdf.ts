import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Analyze a complete Bible PDF to understand its structure
 * This helps identify:
 * - Table of contents
 * - Page ranges for each book
 * - Chapter organization
 */

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface BibleStructure {
  totalPages: number;
  books: BookLocation[];
  tableOfContents?: string;
}

interface BookLocation {
  bookName: string;
  amharicName: string;
  section: 'OT' | 'NT' | 'Apocrypha';
  startPage: number;
  endPage?: number;
  chapters: number;
}

/**
 * Analyze the first 20 pages to find Table of Contents
 */
async function analyzeTOC(pdfPath: string): Promise<string> {
  try {
    console.log('📖 Analyzing Table of Contents from first 20 pages...');

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

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
              text: `Analyze the first 20 pages of this Catholic Amharic Bible PDF.

TASK:
1. Find the Table of Contents (ማውጫ or ይዘቶች)
2. Extract the list of books with their page numbers
3. Identify if page numbers are listed

OUTPUT FORMAT:
Return a detailed table showing:
- Book name (Amharic)
- Book name (English if available)
- Starting page number
- Section (Old Testament/New Testament/Deuterocanonical)

Example:
ኦሪት ዘፍጥረት (Genesis) - Page 1 - Old Testament
ኦሪት ዘጸአት (Exodus) - Page 85 - Old Testament
...

If no clear TOC found, describe the document structure you see.`
            }
          ]
        }
      ],
      config: {
        temperature: 0.1
      }
    });

    return response.text || 'No TOC found';

  } catch (error) {
    console.error('Error analyzing TOC:', error);
    throw error;
  }
}

/**
 * Extract a specific page range from PDF
 */
async function extractPageRange(
  pdfPath: string,
  startPage: number,
  endPage: number,
  bookName: string
): Promise<string> {
  try {
    console.log(`\n📄 Extracting ${bookName} (pages ${startPage}-${endPage})...`);

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

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
              text: `Extract ALL text from pages ${startPage} to ${endPage} of this PDF.

This should contain the book: ${bookName}

INSTRUCTIONS:
1. Extract all Amharic text
2. Preserve verse numbers if visible
3. Maintain chapter divisions
4. Do not add commentary
5. Return raw extracted text only

Focus on pages ${startPage} through ${endPage}.`
            }
          ]
        }
      ],
      config: {
        temperature: 0.1
      }
    });

    return response.text || '';

  } catch (error) {
    console.error(`Error extracting pages ${startPage}-${endPage}:`, error);
    throw error;
  }
}

/**
 * Identify book boundaries in a full Bible PDF
 */
async function identifyBookBoundaries(pdfPath: string): Promise<BibleStructure> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('📚 ANALYZING CATHOLIC AMHARIC BIBLE PDF STRUCTURE');
    console.log('='.repeat(80));

    // First, analyze TOC
    const tocContent = await analyzeTOC(pdfPath);

    console.log('\n📋 Table of Contents Found:');
    console.log('-'.repeat(80));
    console.log(tocContent);
    console.log('-'.repeat(80));

    // Save TOC analysis
    const outputDir = './output/analysis';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      `${outputDir}/table_of_contents.txt`,
      tocContent,
      'utf-8'
    );

    console.log(`\n💾 TOC analysis saved to: ${outputDir}/table_of_contents.txt`);

    // Return structure (you can enhance this based on TOC analysis)
    return {
      totalPages: 0, // Would need to determine from PDF metadata
      books: [], // Parse from TOC
      tableOfContents: tocContent
    };

  } catch (error) {
    console.error('Error identifying book boundaries:', error);
    throw error;
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
📖 Catholic Amharic Bible PDF Analyzer

USAGE:
  pnpm tsx scripts/analyze-bible-pdf.ts <pdf_path>

EXAMPLE:
  pnpm tsx scripts/analyze-bible-pdf.ts "./The Amharic Bible.pdf"

OUTPUT:
  - Table of contents structure
  - Book locations and page numbers
  - Recommendations for extraction
    `);
    process.exit(1);
  }

  const [pdfPath] = args;

  try {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    const structure = await identifyBookBoundaries(pdfPath);

    console.log('\n' + '='.repeat(80));
    console.log('✅ ANALYSIS COMPLETE');
    console.log('='.repeat(80));
    console.log('\n📊 Next Steps:');
    console.log('1. Review the TOC analysis in: ./output/analysis/table_of_contents.txt');
    console.log('2. Identify page ranges for each book');
    console.log('3. Create extraction config with correct page ranges');
    console.log('4. Run batch extraction with page-specific configs');
    console.log('');

  } catch (error) {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { identifyBookBoundaries, analyzeTOC, extractPageRange };
