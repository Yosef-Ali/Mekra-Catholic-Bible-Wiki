
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });
const OUTPUT_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/extraction_output';

async function fixToCsv(filename: string) {
  console.log(`Converting ${filename} to CSV...`);
  const rawPath = path.join(OUTPUT_DIR, filename);
  const rawText = fs.readFileSync(rawPath, 'utf-8');

  const prompt = `
    The previous attempt to create JSON failed.
    Please extract the BIBLE VERSES from the text below into a CSV format.
    
    FORMAT:
    Chapter,Verse,Text
    
    RULES:
    - Comma separated.
    - Quote the Text field if it contains commas.
    - Escape quotes in text by doubling them ("").
    - One verse per line.
    - Ignore intro/footnotes.
    - Return ONLY the CSV data.
    
    SOURCE TEXT:
    ${rawText}
    `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ text: prompt }] }],
      // No responseMimeType: "application/json"
    });

    const text = response.text;
    if (text) {
      const cleaned = text.replace(/```csv/g, '').replace(/```/g, '').trim();

      const chaptersMap = parseCsvLines(cleaned);

      // Construct JSON
      const chapters = [];
      for (const [chNum, content] of chaptersMap.entries()) {
        chapters.push({
          chapter_number: chNum,
          content: content
        });
      }

      const json = { chapters };
      // Use filename_fixed.json
      const jsonName = filename.replace('_raw.txt', '.json');
      fs.writeFileSync(path.join(OUTPUT_DIR, jsonName), JSON.stringify(json, null, 2));
      console.log(`✅ Fixed (via CSV) and saved to ${jsonName}`);
    }
  } catch (e) {
    console.error(`Failed to fix ${filename}:`, e);
  }
}

const args = process.argv.slice(2);
if (args.length > 0) {
  fixToCsv(args[0]);
}

export function parseCsvLines(csvText: string): Map<number, any[]> {
  const lines = csvText.split('\n');
  const chaptersMap = new Map();

  for (const line of lines) {
    if (!line.trim() || !line.includes(',')) continue;

    // Skip header if present
    if (line.toLowerCase().startsWith('chapter,verse,text')) continue;

    const match = line.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(?:"([^"]*(?:""[^"]*)*)"|([^,]*))(.*)?$/);

    if (match) {
      const ch = parseInt(match[1]);
      const vn = parseInt(match[2]);
      let txt = match[3] ? match[3] : match[4];

      if (txt) {
        if (match[3]) {
          txt = txt.replace(/""/g, '"');
        }
        txt = txt.trim();

        // Fix 1: Ensure map entry exists
        if (!chaptersMap.has(ch)) {
          chaptersMap.set(ch, []);
        }
        chaptersMap.get(ch).push({
          type: "verse",
          number: vn,
          text: txt
        });
      } else {
        console.warn(`⚠️ Skipped line (no text found): ${line}`);
      }
    } else {
      console.warn(`⚠️ Skipped line (no match): ${line}`);
    }
  }
  return chaptersMap;
}
