import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Extract specific page range from large PDF
 * This works around token limits by processing smaller chunks
 */

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function extractSpecificPages(
  pdfPath: string,
  startPage: number,
  endPage: number,
  bookName?: string
) {
  console.log(`\n📖 Extracting pages ${startPage}-${endPage} from PDF...\n`);

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const prompt = `Extract ALL text from pages ${startPage} to ${endPage} (ONLY these pages).

${bookName ? `This should contain: ${bookName}` : ''}

INSTRUCTIONS:
1. Extract all Amharic text exactly as shown
2. Preserve any verse numbers you see
3. Maintain paragraph structure
4. Keep chapter divisions if visible
5. Return ONLY the extracted text, no commentary

Focus ONLY on pages ${startPage} through ${endPage}.`;

  try {
    // Use experimental model with larger context window
    const response = await ai.models.generateContent({
      model: 'gemini-exp-1206',
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pdfBase64
              }
            },
            { text: prompt }
          ]
        }
      ]
    });

    const extracted = response.text || '';

    // Save output
    const outputDir = './output/pages';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `pages_${startPage}-${endPage}.txt`;
    fs.writeFileSync(`${outputDir}/${filename}`, extracted, 'utf-8');

    console.log(`✅ Extracted ${extracted.length} characters`);
    console.log(`💾 Saved to: ${outputDir}/${filename}\n`);

    return extracted;

  } catch (error: any) {
    console.error('❌ Extraction error:', error.message);

    if (error.status === 400 && error.message.includes('token')) {
      console.log('\n💡 Tip: Try smaller page ranges (e.g., 1-5 pages at a time)');
    }

    throw error;
  }
}

// CLI
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log(`
📄 Page-Specific PDF Extractor

USAGE:
  pnpm tsx scripts/extract-pages.ts <pdf_path> <start_page> <end_page> [book_name]

EXAMPLES:
  pnpm tsx scripts/extract-pages.ts "./bible.pdf" 1 5
  pnpm tsx scripts/extract-pages.ts "./bible.pdf" 1 10 "Genesis"
  pnpm tsx scripts/extract-pages.ts "./bible.pdf" 50 60 "Exodus"

TIPS:
  - Start with small ranges (1-10 pages)
  - Once you know the structure, process larger chunks
  - Use book name to help AI identify content
  `);
  process.exit(1);
}

const [pdfPath, startStr, endStr, bookName] = args;
extractSpecificPages(
  pdfPath,
  parseInt(startStr),
  parseInt(endStr),
  bookName
).catch(console.error);
