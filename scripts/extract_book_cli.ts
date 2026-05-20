import { GoogleGenAI } from '@google/genai';
import { PDFDocument } from 'pdf-lib';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY is missing in .env');
  process.exit(1);
}

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Configuration
const PDF_NAME = 'The Amharic Bible - eBook Quality.pdf';
const PDF_PATH = path.join(process.cwd(), PDF_NAME);
const OUTPUT_DIR = path.join(process.cwd(), 'extraction_output');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

/**
 * Extracts a specific page range from the large PDF.
 * Returns the path to the temporary PDF file.
 */
async function extractPdfChunk(startPage: number, endPage: number, tempName: string): Promise<string> {
  // console.log(`✂️ Splitting PDF (Pages ${startPage}-${endPage})...`);

  if (!fs.existsSync(PDF_PATH)) {
    throw new Error(`PDF not found at ${PDF_PATH}`);
  }

  const existingPdfBytes = fs.readFileSync(PDF_PATH);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const newPdfDoc = await PDFDocument.create();

  // Pages are 0-indexed in pdf-lib, but user input is 1-indexed
  const range = [];
  for (let i = startPage - 1; i < endPage; i++) {
    range.push(i);
  }

  const copiedPages = await newPdfDoc.copyPages(pdfDoc, range);
  copiedPages.forEach(page => newPdfDoc.addPage(page));

  const pdfBytes = await newPdfDoc.save();
  const tempPath = path.join(OUTPUT_DIR, tempName);
  fs.writeFileSync(tempPath, pdfBytes);

  // console.log(`✅ Created chunk: ${tempPath} (${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB)`);
  return tempPath;
}

/**
 * Extracts content from a single chunk of pages
 */
async function extractChunk(bookName: string, startPage: number, endPage: number): Promise<any> {
  const tempPdfName = `${bookName}_chunk_${startPage}-${endPage}.pdf`;
  let tempPdfPath = path.join(OUTPUT_DIR, tempPdfName);

  try {
    if (!fs.existsSync(tempPdfPath)) {
      await extractPdfChunk(startPage, endPage, tempPdfName);
    }

    const fileBuffer = fs.readFileSync(tempPdfPath);
    const base64Data = fileBuffer.toString('base64');

    console.log(`🤖 Processing Chunk: Pages ${startPage}-${endPage}...`);

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
        - Do not skip verses.
        - Parsing pages ${startPage}-${endPage}.
        - If a chapter is cut off at the start/end, just extract what is visible.
        - Return ONLY valid JSON.
        `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ inlineData: { mimeType: "application/pdf", data: base64Data } }, { text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");

    // Clean Markdown
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText);

  } catch (error) {
    console.error(`❌ Chunk ${startPage}-${endPage} Failed:`, error);
    return { chapters: [] };
  }
}

/**
 * Main Batched Extraction Function
 */
async function extractBookBatched(bookName: string, startPage: number, endPage: number, batchSize: number = 3) {
  console.log(`🚀 Starting Batched Extraction for ${bookName} (Pages ${startPage}-${endPage})`);

  let allChapters: any[] = [];

  for (let current = startPage; current <= endPage; current += batchSize) {
    const batchEnd = Math.min(current + batchSize - 1, endPage);
    const chunkData = await extractChunk(bookName, current, batchEnd);

    if (chunkData && chunkData.chapters) {
      // Merge Logic
      if (allChapters.length > 0 && chunkData.chapters.length > 0) {
        const lastChapter = allChapters[allChapters.length - 1];
        const firstNewChapter = chunkData.chapters[0];

        if (lastChapter.chapter_number === firstNewChapter.chapter_number) {
          console.log(`__ Merging split Chapter ${lastChapter.chapter_number}...`);
          lastChapter.content = [...lastChapter.content, ...firstNewChapter.content];
          // Add remaining new chapters
          allChapters = [...allChapters, ...chunkData.chapters.slice(1)];
        } else {
          allChapters = [...allChapters, ...chunkData.chapters];
        }
      } else {
        allChapters = [...allChapters, ...chunkData.chapters];
      }
    }
  }

  const finalJson = {
    book: {
      book_name: bookName,
      total_chapters: allChapters.length,
      chapters: allChapters
    }
  };

  const jsonPath = path.join(OUTPUT_DIR, `${bookName}_extracted.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(finalJson, null, 2));
  console.log(`🎉 Full Extraction Complete! Saved to ${jsonPath}`);
  console.log(`📊 Total Chapters: ${allChapters.length}`);
}

// --- COMMANDS ---
// --- COMMANDS ---
const args = process.argv.slice(2);
if (args.length >= 3) {
  const bookName = args[0];
  const startPage = parseInt(args[1]);
  const endPage = parseInt(args[2]);
  const batchSize = args[3] ? parseInt(args[3]) : 3;

  if (isNaN(startPage) || isNaN(endPage)) {
    console.error("❌ Start and End pages must be numbers");
    process.exit(1);
  }

  console.log(`Starting extraction for ${bookName} (${startPage}-${endPage}) with batch size ${batchSize}...`);
  extractBookBatched(bookName, startPage, endPage, batchSize);
} else {
  console.log("Usage: tsx scripts/extract_book_cli.ts <BookName> <StartPage> <EndPage> [BatchSize]");
  console.log("Example: tsx scripts/extract_book_cli.ts Wisdom 1025 1055 3");
}
