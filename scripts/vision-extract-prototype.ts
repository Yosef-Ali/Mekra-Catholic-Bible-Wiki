import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function extractFromImage(imagePath: string) {
  console.log(`🖼️ Processing image: ${imagePath}`);

  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString('base64');

  const prompt = `
  You are an expert in Ethiopian Biblical manuscripts and Amharic formatting.
  Your task is to extract the content from this Bible page image into a structured JSON format.
  
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
  
  For "poetry", do not use "text", use "lines" array.
  For "verse", include the verse number in "number" and the rest in "text".
  For "section_header", this is the subtitle within a chapter.
  
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
                mimeType: 'image/png',
                data: imageBase64
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

    // Save to file for inspection
    const outputPath = 'extraction_result.json';
    fs.writeFileSync(outputPath, response.text || '', 'utf-8');
    console.log(`\n✅ Saved result to ${outputPath}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Use the first uploaded image
const imagePath = '/Users/mekdesyared/.gemini/antigravity/brain/fd98d28f-3ae2-47cc-a0f9-1f6580e8ce55/uploaded_image_2_1764830781739.png';

extractFromImage(imagePath);
