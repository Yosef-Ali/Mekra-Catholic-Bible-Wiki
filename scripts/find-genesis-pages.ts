import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PDF_PATH = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';

async function findGenesisPages() {
  console.log('📖 Searching for Genesis (ኦሪት ዘፍጥረት) in the PDF...\n');

  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const pdfBase64 = pdfBuffer.toString('base64');

  const prompt = `
  This is an Amharic Bible PDF. I need to find the Book of Genesis (ኦሪት ዘፍጥረት).
  
  Please tell me:
  1. What page number does Genesis (ኦሪት ዘፍጥረት) START on?
  2. What page number does Genesis END on (before the next book starts)?
  
  Look for the book title "ኦሪት ዘፍጥረት" or "ዘፍጥረት" (Genesis in Amharic).
  
  Return your answer as JSON:
  {
    "book_name": "Genesis",
    "amharic_name": "ኦሪት ዘፍጥረት",
    "start_page": <number>,
    "end_page": <number>,
    "notes": "<any relevant observations>"
  }
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

    console.log('Result:', response.text);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findGenesisPages();
