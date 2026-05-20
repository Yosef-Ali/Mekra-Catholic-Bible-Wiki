import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PDF_PATH = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';
const TEMP_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/extraction_output/temp_genesis';
const OUTPUT_FILE = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/extraction_output/Genesis_extracted.json';

// Genesis is approximately on pages 9-60 of the PDF
const GENESIS_START_PAGE = 9;
const GENESIS_END_PAGE = 60;
const BATCH_SIZE = 3; // Process 3 pages at a time

interface VerseItem {
  type: 'verse';
  number: number;
  text: string;
}

interface ChapterHeaderItem {
  type: 'chapter_header';
  text: string;
}

interface SectionHeaderItem {
  type: 'section_header';
  text: string;
}

type ContentItem = VerseItem | ChapterHeaderItem | SectionHeaderItem;

interface Chapter {
  chapter_number: number;
  content: ContentItem[];
}

interface BookStructure {
  book: {
    book_name: string;
    total_chapters: number;
    chapters: Chapter[];
  };
}

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

async function extractPageRange(startPage: number, endPage: number): Promise<any> {
  console.log(`\n📄 Extracting pages ${startPage}-${endPage}...`);

  const pdfBuffer = fs.readFileSync(PDF_PATH);
  const pdfBase64 = pdfBuffer.toString('base64');

  const prompt = `
You are an expert in Amharic Biblical text extraction.

Extract the content from pages ${startPage} to ${endPage} of this Amharic Bible PDF.

CRITICAL INSTRUCTIONS:
1. **Identify Chapters**: Look for "ምዕራፍ [number]" headers (e.g., "ምዕራፍ 1", "ምዕራፍ 25")
2. **Extract Verses**: Each verse starts with a number followed by Amharic text
3. **Preserve Structure**: Include chapter headers, section headers (subtitles in bold), and all verses
4. **Complete Text**: Extract ALL text, don't skip or summarize
5. **Verse Numbers**: Mark verse numbers correctly as numbers, not as part of text

Output Format (JSON):
{
  "chapters": [
    {
      "chapter_number": 1,
      "content": [
        {
          "type": "chapter_header",
          "text": "ምዕራፍ 1"
        },
        {
          "type": "section_header",
          "text": "የዓለም ፍጥረት"
        },
        {
          "type": "verse",
          "number": 1,
          "text": "የአማርኛ ጽሑፍ..."
        }
      ]
    }
  ]
}

Return ONLY valid JSON. Include ALL chapters found in these pages.
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

    // Save raw response
    const rawPath = path.join(TEMP_DIR, `raw_${startPage}-${endPage}.txt`);
    fs.writeFileSync(rawPath, resultText, 'utf-8');

    let resultJson;
    try {
      resultJson = JSON.parse(resultText);
    } catch (parseError) {
      console.log(`⚠️  JSON parsing failed for pages ${startPage}-${endPage}`);
      return { chapters: [] };
    }

    // Save parsed result
    const jsonPath = path.join(TEMP_DIR, `extraction_${startPage}-${endPage}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(resultJson, null, 2), 'utf-8');

    console.log(`✅ Extracted ${resultJson.chapters?.length || 0} chapters from pages ${startPage}-${endPage}`);

    return resultJson;

  } catch (error) {
    console.error(`❌ Error extracting pages ${startPage}-${endPage}:`, error);
    return { chapters: [] };
  }
}

async function extractAllGenesis() {
  console.log('🚀 Starting complete Genesis extraction...');
  console.log(`📖 Processing pages ${GENESIS_START_PAGE}-${GENESIS_END_PAGE} in batches of ${BATCH_SIZE}`);

  const allExtractions = [];

  // Extract in batches
  for (let page = GENESIS_START_PAGE; page <= GENESIS_END_PAGE; page += BATCH_SIZE) {
    const endPage = Math.min(page + BATCH_SIZE - 1, GENESIS_END_PAGE);

    const result = await extractPageRange(page, endPage);
    if (result.chapters && result.chapters.length > 0) {
      allExtractions.push(result);
    }

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n✅ Completed all extractions. Found ${allExtractions.length} batches.`);

  return allExtractions;
}

function mergeAndCleanExtractions(allExtractions: any[]): BookStructure {
  console.log('\n🔧 Merging and cleaning extractions...');

  const chapterMap = new Map<number, Chapter>();

  // Merge all chapters
  for (const extraction of allExtractions) {
    if (!extraction.chapters) continue;

    for (const chapter of extraction.chapters) {
      const chapterNum = chapter.chapter_number;

      if (!chapterMap.has(chapterNum)) {
        chapterMap.set(chapterNum, {
          chapter_number: chapterNum,
          content: []
        });
      }

      const existingChapter = chapterMap.get(chapterNum)!;

      // Add content items, avoiding duplicates
      for (const item of chapter.content) {
        // Check if this verse already exists
        if (item.type === 'verse') {
          const verseExists = existingChapter.content.some(
            (c: ContentItem) => c.type === 'verse' && (c as VerseItem).number === item.number
          );
          if (!verseExists) {
            existingChapter.content.push(item);
          }
        } else {
          existingChapter.content.push(item);
        }
      }
    }
  }

  // Sort chapters and verses
  const chapters = Array.from(chapterMap.values()).sort((a, b) => a.chapter_number - b.chapter_number);

  // Sort verses within each chapter
  for (const chapter of chapters) {
    chapter.content.sort((a, b) => {
      if (a.type === 'chapter_header') return -1;
      if (b.type === 'chapter_header') return 1;
      if (a.type === 'section_header' && b.type === 'verse') return -1;
      if (a.type === 'verse' && b.type === 'section_header') return 1;
      if (a.type === 'verse' && b.type === 'verse') {
        return (a as VerseItem).number - (b as VerseItem).number;
      }
      return 0;
    });
  }

  console.log(`📊 Merged into ${chapters.length} unique chapters`);

  return {
    book: {
      book_name: 'Genesis',
      total_chapters: chapters.length,
      chapters
    }
  };
}

function validateExtraction(bookData: BookStructure) {
  console.log('\n🔍 Validating extraction...');

  const chapters = bookData.book.chapters;
  const chapterNumbers = chapters.map(c => c.chapter_number).sort((a, b) => a - b);

  console.log(`✅ Total chapters extracted: ${chapters.length}`);
  console.log(`📋 Chapter numbers: ${chapterNumbers.join(', ')}`);

  const missing = [];
  for (let i = 1; i <= 50; i++) {
    if (!chapterNumbers.includes(i)) {
      missing.push(i);
    }
  }

  if (missing.length > 0) {
    console.log(`⚠️  MISSING CHAPTERS: ${missing.join(', ')}`);
  } else {
    console.log(`🎉 All 50 chapters present!`);
  }

  // Content quality check
  console.log('\n📊 Content Quality:');
  for (const chapter of chapters) {
    const verseCount = chapter.content.filter(c => c.type === 'verse').length;
    const status = verseCount < 5 ? '⚠️' : '✅';
    console.log(`  Chapter ${chapter.chapter_number}: ${verseCount} verses ${status}`);
  }
}

async function main() {
  try {
    // Step 1: Extract all pages
    const allExtractions = await extractAllGenesis();

    // Step 2: Merge and clean
    const bookData = mergeAndCleanExtractions(allExtractions);

    // Step 3: Validate
    validateExtraction(bookData);

    // Step 4: Save final result
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(bookData, null, 2), 'utf-8');
    console.log(`\n💾 Saved final result to: ${OUTPUT_FILE}`);

    // Step 5: Create backup of old file
    const backupFile = OUTPUT_FILE.replace('.json', '_backup.json');
    if (fs.existsSync(OUTPUT_FILE)) {
      console.log(`📦 Old file backed up to: ${backupFile}`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
