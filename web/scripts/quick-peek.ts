import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Quick peek at PDF content - see first few pages
 */

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function quickPeek(pdfPath: string) {
  console.log('👀 Taking a quick peek at your PDF...\n');

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');
  const fileSizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);

  console.log(`📊 File size: ${fileSizeMB} MB`);
  console.log('🤖 Asking Gemini to describe the first 5 pages...\n');

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
            text: `Quickly analyze the first 5 pages of this PDF.

Tell me:
1. What is this document? (Title, type)
2. Is there a table of contents? If yes, list the first 10 entries
3. What language is it in?
4. Does it have page numbers?
5. Any chapter/verse numbering visible?
6. Estimated total number of pages (if visible)

Be concise but informative.`
          }
        ]
      }
    ],
    config: {
      temperature: 0.1
    }
  });

  console.log('📖 PDF Content Preview:');
  console.log('='.repeat(80));
  console.log(response.text);
  console.log('='.repeat(80));
}

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.log('Usage: pnpm tsx scripts/quick-peek.ts <pdf_path>');
  process.exit(1);
}

quickPeek(pdfPath).catch(console.error);
