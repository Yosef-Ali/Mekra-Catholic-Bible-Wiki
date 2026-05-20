import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Simple PDF text extractor for large Amharic Bible PDFs
 * Extracts all text content and saves to a file
 */

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function extractFullPdf(pdfPath: string, outputPath: string = './extracted_bible.txt') {
  try {
    console.log('📖 Starting extraction of Amharic Bible PDF...');
    console.log(`📄 Input: ${pdfPath}`);
    console.log(`💾 Output: ${outputPath}`);
    console.log('⏳ This may take a few minutes for large PDFs...\n');

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');
    const fileSizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);

    console.log(`📊 PDF Size: ${fileSizeMB} MB`);
    console.log('🤖 Sending to Gemini AI for extraction...\n');

    // Extract text using Gemini
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
              text: `Extract ALL text from this Amharic Catholic Bible PDF.

INSTRUCTIONS:
1. Extract every single line of text from the PDF
2. Preserve the Amharic text exactly as written
3. Maintain the original structure and formatting
4. Include all book names, chapter numbers, and verse numbers
5. Do NOT add any commentary or explanations
6. Do NOT skip any content
7. Return the complete text in order from first page to last

This is a complete Bible, so the output will be very long. Extract everything.`
            }
          ]
        }
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 8000 // Maximum for thorough extraction
      }
    });

    const extractedText = response.text || '';

    if (!extractedText) {
      throw new Error('No text was extracted from the PDF');
    }

    // Save to file
    fs.writeFileSync(outputPath, extractedText, 'utf-8');

    const lines = extractedText.split('\n').length;
    const chars = extractedText.length;

    console.log('✅ Extraction Complete!\n');
    console.log('📊 Statistics:');
    console.log(`   Lines: ${lines.toLocaleString()}`);
    console.log(`   Characters: ${chars.toLocaleString()}`);
    console.log(`   File: ${outputPath}`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Review the extracted text');
    console.log('   2. Check for any missing content');
    console.log('   3. Use this as source for database seeding');

    return extractedText;

  } catch (error) {
    console.error('\n❌ Extraction failed:', error);
    throw error;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
📖 Simple Amharic Bible PDF Extractor

USAGE:
  pnpm extract:simple <pdf_path> [output_path]

EXAMPLES:
  pnpm extract:simple "./bible.pdf"
  pnpm extract:simple "./bible.pdf" "./my_output.txt"

OUTPUT:
  - Complete extracted text saved to file
  - Ready for review and processing
    `);
    process.exit(1);
  }

  const [pdfPath, outputPath] = args;

  try {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    await extractFullPdf(pdfPath, outputPath);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { extractFullPdf };
