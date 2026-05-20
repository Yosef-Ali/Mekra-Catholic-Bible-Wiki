
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });
const OUTPUT_DIR = 'extraction_output';

async function convert(bookName: string, textFile: string) {
  console.log(`Converting ${bookName} from ${textFile}...`);
  const rawText = fs.readFileSync(textFile, 'utf-8');

  // Chunk by lines or characters. 4000 chars ~ 1000-1500 tokens. Safe output 8k.
  const CHUNK_SIZE = 8000;
  const chunks = [];
  for (let i = 0; i < rawText.length; i += CHUNK_SIZE) {
    chunks.push(rawText.slice(i, i + CHUNK_SIZE));
  }

  console.log(`Split into ${chunks.length} chunks.`);

  let allChapters: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing Chunk ${i + 1}/${chunks.length}...`);
    const chunkText = chunks[i];

    const prompt = `
        You are an expert Bible Typesetter and Theologian specializing in Amharic manuscripts.
        Your task is to parse the provided raw text content of the book "${bookName}" into a structured JSON format.

        **SOURCE TEXT CHUNK (${i + 1}/${chunks.length})**:
        ${chunkText}

        STRICT SCHEMA RULES:
        1. **Structure**: Identify 'chapter_header' (e.g. ምዕራፍ 1), 'section_header', 'verse', 'poetry'.
        2. **Verses**: Extract 'number' (integer) and 'text' separately. 
           - Isolate the BIBLE TEXT from footnotes/commentary.
           - Footnotes usually start with letters like 'ሀ', 'ለ', or appear small. IGNORE THEM if they are commentary.
           - We ONLY want scriptural content.
        3. **Poetry**: If indentation suggests poetry, use "type": "poetry".
        4. **Continuity**: If a chunk starts in the middle of a chapter, just list the verses found.
        
        OUTPUT FORMAT (JSON ONLY):
        {
          "chapters": [
              {
                "chapter_number": 1, 
                "content": [
                   { "type": "verse", "number": 1, "text": "..." }
                ]
              }
          ]
        }

        IMPORTANT:
        - Return ONLY valid JSON.
        - Do not hallucinate content not in the chunk.
        - ESCAPE all newlines in strings. Use \\n. Do not output raw newlines inside strings.
        - If no bible content is found in chunk, return { "chapters": [] }.
        `;


    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const text = response.text;
      if (text) {
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        let json;
        try {
          json = JSON.parse(cleanJson);
        } catch (e) {
          console.error(`Chunk ${i + 1} JSON Parse Error. Dumping raw text.`);
          fs.writeFileSync(path.join(OUTPUT_DIR, `${bookName}_chunk_${i + 1}_raw.txt`), text);
          continue;
        }

        if (json.chapters) {
          fs.writeFileSync(path.join(OUTPUT_DIR, `${bookName}_chunk_${i + 1}.json`), JSON.stringify(json, null, 2));
          console.log(`✅ Saved chunk ${i + 1}`);
        }
      }
    } catch (e) {
      console.error(`Chunk ${i + 1} failed:`, e);
    }
  }

}

const args = process.argv.slice(2);
if (args.length === 2) {
  convert(args[0], args[1]);
} else {
  console.log("Usage: tsx scripts/convert_text.ts <BookName> <TextFile>");
}
