import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Configuration
const PDF_PATH = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';
const OUTPUT_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/processed_vision';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface ExtractionItem {
  type: 'book_title' | 'introduction_title' | 'introduction_text' | 'chapter_header' | 'section_header' | 'verse' | 'poetry';
  number?: number;
  text?: string;
  lines?: string[];
}

interface ExtractionResult {
  items: ExtractionItem[];
}

/**
 * Extracts content from a specific page range of the PDF using Gemini Vision.
 * Note: Gemini 1.5/2.0 can process PDFs directly.
 */
async function extractRange(startPage: number, endPage: number) {
  console.log(`\n📄 Processing Pages ${startPage}-${endPage}...`);

  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const pdfBase64 = pdfBuffer.toString('base64');

  const prompt = `
  You are an expert in Ethiopian Biblical manuscripts and Amharic formatting.
  Your task is to extract the content from the attached Bible document (pages ${startPage} to ${endPage}) into a structured JSON format.
  
  **SCOPE**: Only extract content from pages ${startPage} to ${endPage}.
  
  Pay close attention to:
  1. **Structure**: Identify the Book Title, Introduction (Megbia), Chapter Headers, Subtitles (often in bold/larger text in the middle of chapters), and Verses.
  2. **Poetry**: Identify sections formatted as poetry (indented lines, stanzas) and mark them as such.
  3. **Numbers**: Ensure all verse numbers are correctly identified as numbers, not text.
  4. **Amharic Text**: Transcribe the Amharic text exactly as it appears.
  5. **Continuity**: If a sentence or verse spans across pages, combine them intelligently if possible, or just output them in sequence.
  
  Output Format (JSON):
  {
    "items": [
      {
        "type": "book_title" | "introduction_title" | "introduction_text" | "chapter_header" | "section_header" | "verse" | "poetry",
        "number": number (for chapters/verses, optional),
        "text": string (the content),
        "lines": string[] (only for poetry type)
      }
    ]
  }
  
  Return ONLY valid JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
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
              text: prompt
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    const resultText = response.text || '{}';

    // Save raw response first (for debugging)
    const rawFilename = `raw_pages_${startPage}-${endPage}.txt`;
    const rawPath = path.join(OUTPUT_DIR, rawFilename);
    fs.writeFileSync(rawPath, resultText, 'utf-8');

    let resultJson: ExtractionResult;
    try {
      resultJson = JSON.parse(resultText) as ExtractionResult;
    } catch (parseError) {
      console.log(`⚠️  JSON parsing failed, attempting repair...`);

      // Try to find valid JSON object
      const startIdx = resultText.indexOf('{');
      const endIdx = resultText.lastIndexOf('}');

      if (startIdx !== -1 && endIdx !== -1) {
        const trimmed = resultText.substring(startIdx, endIdx + 1);
        // Try to fix common issues: escape unescaped quotes in strings
        try {
          resultJson = JSON.parse(trimmed) as ExtractionResult;
          console.log(`✅ JSON repair successful`);
        } catch {
          console.log(`❌ JSON repair failed. Raw response saved to: ${rawPath}`);
          return null;
        }
      } else {
        console.log(`❌ Could not find JSON in response. Raw saved to: ${rawPath}`);
        return null;
      }
    }

    console.log(`✅ Extracted ${resultJson.items.length} items from pages ${startPage}-${endPage}`);

    // Save to file
    const filename = `extraction_pages_${startPage}-${endPage}.json`;
    const outputPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outputPath, JSON.stringify(resultJson, null, 2), 'utf-8');
    console.log(`💾 Saved to ${outputPath}`);

    return resultJson;

  } catch (error) {
    console.error(`❌ Error processing pages ${startPage}-${endPage}:`, error);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/extract_bible_vision.ts <start_page> <end_page>');
    console.log('Example: npx tsx scripts/extract_bible_vision.ts 1 3');
    process.exit(1);
  }

  const startPage = parseInt(args[0]);
  const endPage = parseInt(args[1]);

  await extractRange(startPage, endPage);
}

main();
