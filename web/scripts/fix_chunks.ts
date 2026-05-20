
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });
const OUTPUT_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/extraction_output';

async function fixChunk(filename: string) {
  console.log(`Fixing ${filename}...`);
  const rawPath = path.join(OUTPUT_DIR, filename);
  const rawText = fs.readFileSync(rawPath, 'utf-8');

  const prompt = `
    The following text is intended to be JSON but contains syntax errors (e.g. unescaped characters, trailing text, markdown).
    
    Please REPAIR it into VALID JSON.
    Do not change the content structure (chapters > content).
    Ensure all strings are properly escaped.
    
    BROKEN JSON:
    ${rawText}
    
    OUTPUT JSON ONLY.
    `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });

    const text = response.text;
    if (text) {
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      JSON.parse(clean); // Validate

      const jsonName = filename.replace('_raw.txt', '.json');
      fs.writeFileSync(path.join(OUTPUT_DIR, jsonName), clean);
      console.log(`✅ Fixed and saved to ${jsonName}`);
    }
  } catch (e) {
    console.error(`Failed to fix ${filename}:`, e);
  }
}

const args = process.argv.slice(2);
if (args.length > 0) {
  fixChunk(args[0]);
} else {
  // Auto-find
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('_raw.txt'));
  files.forEach(f => fixChunk(f));
}
