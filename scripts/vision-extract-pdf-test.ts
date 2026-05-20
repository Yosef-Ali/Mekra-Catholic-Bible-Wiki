import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function extractFromPdf(pdfPath: string) {
  console.log(`📄 Processing PDF: ${pdfPath}`);

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const prompt = `
  You are an expert in Ethiopian Biblical manuscripts and Amharic formatting.
  Your task is to extract the content from this Bible document into a structured JSON format.
  
  **Process ONLY the first 3 pages for this test.**
  
  Pay close attention to:
  1. **Structure**: Identify the Book Title, Introduction (Megbia), Chapter Headers, Subtitles (often in bold/larger text in the middle of chapters), and Verses.
  2. **Poetry**: Identify sections formatted as poetry (indented lines, stanzas) and mark them as such.
  3. **Numbers**: Ensure all verse numbers are correctly identified as numbers, not text.
  4. **Amharic Text**: Transcribe the Amharic text exactly as it appears.
  
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

    console.log(response.text);

    const outputPath = 'pdf_extraction_result.json';
    fs.writeFileSync(outputPath, response.text || '', 'utf-8');
    console.log(`\n✅ Saved result to ${outputPath}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

const pdfPath = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';
extractFromPdf(pdfPath);
