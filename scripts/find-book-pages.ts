import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PDF_PATH = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';

async function findBookPages() {
  console.log('📖 Analyzing PDF structure to find book locations...\n');

  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const pdfBase64 = pdfBuffer.toString('base64');


  const prompt = `
  This is an Amharic Catholic Bible PDF. 
  
  Please provide a table of contents showing the page numbers where these specific books start:
  1. Wisdom of Solomon (መጽሐፈ ጥበብ)
  2. Sirach / Ecclesiasticus (መጽሐፈ ሲራክ)
  
  Return JSON:
  {
    "books": [
      {"name": "Wisdom", "amharic": "መጽሐፈ ጥበብ", "start_page": <number>},
      {"name": "Sirach", "amharic": "መጽሐፈ ሲራክ", "start_page": <number>}
    ]
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

findBookPages();
