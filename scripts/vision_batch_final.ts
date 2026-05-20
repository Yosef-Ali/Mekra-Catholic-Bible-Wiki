
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("❌ GEMINI_API_KEY missing");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const PDF_PATH = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';
const OUTPUT_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/extraction_output';

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function extractRange(bookName: string, startPage: number, endPage: number, base64Data: string) {
  console.log(`🤖 Extracting ${bookName} pages ${startPage}-${endPage}...`);

  const prompt = `
    You are an expert Bible Typesetter and Theologian specializing in Amharic manuscripts.
    Your task is to extract content from the provided Bible PDF pages into a structured JSON format.

    **BOOK**: ${bookName}
    **PAGES**: ${startPage} to ${endPage}

    STRICT SCHEMA RULES:
    1. **Structure**: Identify 'book_title', 'introduction', 'chapter_header', 'section_header' (subtitles), 'verse', 'poetry', 'footnote'.
    2. **Verses**: Extract 'number' (integer) and 'text' separately. Text must be EXACT Amharic.
    3. **Poetry**: If the layout shows indentation/stanzas (common in Psalms, Prophets, and parts of Genesis), use "type": "poetry" and "lines": ["line 1", "line 2"].
    4. **Hierarchy**: Preserve the difference between Chapter headings (H1) and Section headings (H2).
    5. **Introduction**: If found, capture as 'introduction_title' and 'introduction_text'.

    OUTPUT FORMAT (JSON ONLY):
    {
      "chapters": [
          {
            "chapter_number": 1,
            "content": [
               { "type": "chapter_header", "text": "ምዕራፍ 1" },
               { "type": "section_header", "text": "የፍጥረት አጀማመር" },
               { "type": "verse", "number": 1, "text": "በመጀመሪያ እግዚአብሔር..." },
               { "type": "poetry", "lines": ["line 1", "line 2"] }
            ]
          }
      ]
    }
    
    IMPORTANT: 
    - Parse ONLY pages ${startPage}-${endPage}.
    - Return ONLY valid JSON.
    `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ inlineData: { mimeType: "application/pdf", data: base64Data } }, { text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });

    const text = response.text;
    if (!text) {
      console.error(`❌ Empty response for ${startPage}-${endPage}`);
      return { chapters: [] };
    }

    try {
      // Handle markdown
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      console.error(`❌ Parse Error ${startPage}-${endPage}:`, e);
      console.log("Raw Text:", text.substring(0, 500) + "...");
      return { chapters: [] };
    }
  } catch (e) {
    console.error(`❌ Failed batch ${startPage}-${endPage}:`, e);
    return { chapters: [] };
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Usage: tsx scripts/vision_batch_extract.ts <BookName> <Start> <End> [BatchSize]");
    return;
  }

  const [bookName, startStr, endStr, batchStr] = args;
  const startPage = parseInt(startStr);
  const endPage = parseInt(endStr);
  const batchSize = batchStr ? parseInt(batchStr) : 5; // Use 5 pages per batch to keep context reasonable

  console.log(`🚀 Loading PDF...`);
  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const base64Data = pdfBuffer.toString('base64');
  console.log(`✅ PDF Loaded. Starting extraction...`);


  for (let current = startPage; current <= endPage; current += batchSize) {
    const batchEnd = Math.min(current + batchSize - 1, endPage);
    const data = await extractRange(bookName, current, batchEnd, base64Data);

    if (data && data.chapters) {
      const chunkPath = path.join(OUTPUT_DIR, `${bookName}_chunk_${current}-${batchEnd}.json`);
      fs.writeFileSync(chunkPath, JSON.stringify(data, null, 2));
      console.log(`✅ Saved chunk ${current}-${batchEnd}`);
    }
  }
}

main();
