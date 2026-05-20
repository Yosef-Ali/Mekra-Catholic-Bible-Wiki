/**
 * Script to set paragraph breaks and subtitles for Bible chapters
 * 
 * Usage: npx tsx scripts/set-paragraph-breaks.ts
 * 
 * The formattingRules will be updated to include:
 * - paragraphBreaks: number[] - verse numbers that start new paragraphs
 * - subtitles: { verse: number, text: string }[] - subtitles before certain verses
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Define paragraph breaks for each book/chapter
// Format: { bookId: { chapterNumber: { paragraphs: [verse numbers], subtitles: [{verse, text}] } } }
type ChapterFormat = {
  paragraphs?: number[];
  subtitles?: { verse: number; text: string }[];
};

type BookFormat = {
  [chapter: number]: ChapterFormat;
};

type BibleFormat = {
  [bookId: number]: BookFormat;
};

// Genesis (bookId: 147) paragraph breaks based on PDF
const genesisFormat: BookFormat = {
  1: {
    paragraphs: [1, 3, 6, 9, 11, 14, 20, 24, 26, 29],
    subtitles: [
      { verse: 1, text: 'የዓለም አፈጣጠር' }
    ]
  },
  2: {
    paragraphs: [1, 4, 8, 15, 18, 21, 24],
    subtitles: [
      { verse: 4, text: 'አዳምና ሔዋን' }
    ]
  },
  3: {
    paragraphs: [1, 6, 8, 14, 20, 22],
    subtitles: [
      { verse: 1, text: 'የሰው ውድቀት' }
    ]
  },
  4: {
    paragraphs: [1, 3, 6, 9, 13, 17, 19, 23, 25],
    subtitles: [
      { verse: 1, text: 'ቃየንና አቤል' }
    ]
  },
  5: {
    paragraphs: [1, 3, 6, 9, 12, 15, 18, 21, 25, 28, 32],
    subtitles: [
      { verse: 1, text: 'ከአዳም እስከ ኖኅ' }
    ]
  },
};

// Exodus (bookId: 148) 
const exodusFormat: BookFormat = {
  1: {
    paragraphs: [1, 6, 8, 11, 15, 22],
    subtitles: [
      { verse: 1, text: 'እስራኤላውያን በግብጽ' }
    ]
  },
  2: {
    paragraphs: [1, 5, 11, 15, 23],
    subtitles: [
      { verse: 1, text: 'የሙሴ ልደት' }
    ]
  },
  3: {
    paragraphs: [1, 4, 7, 10, 13, 16],
    subtitles: [
      { verse: 1, text: 'ሙሴ እና የሚነድ ቁጥቋጦ' }
    ]
  },
};

// Psalms (bookId: 169) - Each psalm often has natural paragraph breaks
const psalmsFormat: BookFormat = {
  1: {
    paragraphs: [1, 4, 6],
  },
  2: {
    paragraphs: [1, 4, 7, 10],
  },
  3: {
    paragraphs: [1, 3, 5, 7],
  },
  23: {
    paragraphs: [1, 4, 6],
  },
};

// Matthew (bookId: 193)
const matthewFormat: BookFormat = {
  1: {
    paragraphs: [1, 2, 17, 18],
    subtitles: [
      { verse: 1, text: 'የኢየሱስ ክርስቶስ ትውልድ' },
      { verse: 18, text: 'የኢየሱስ ክርስቶስ ልደት' }
    ]
  },
  2: {
    paragraphs: [1, 7, 13, 16, 19],
    subtitles: [
      { verse: 1, text: 'ሰብአ ሰገል' },
      { verse: 13, text: 'ወደ ግብጽ መሸሽ' },
      { verse: 16, text: 'የቤተልሔም ሕፃናት መገደል' }
    ]
  },
  3: {
    paragraphs: [1, 7, 13],
    subtitles: [
      { verse: 1, text: 'መጥምቁ ዮሐንስ' },
      { verse: 13, text: 'የኢየሱስ ጥምቀት' }
    ]
  },
  5: {
    paragraphs: [1, 3, 13, 17, 21, 27, 33, 38, 43],
    subtitles: [
      { verse: 1, text: 'በተራራ ላይ የተሰጠ ትምህርት' },
      { verse: 3, text: 'ብፁዓን' },
      { verse: 13, text: 'ጨውና ብርሃን' }
    ]
  },
};

// John (bookId: 197)
const johnFormat: BookFormat = {
  1: {
    paragraphs: [1, 6, 10, 14, 19, 29, 35, 43],
    subtitles: [
      { verse: 1, text: 'ቃል ሥጋ ሆነ' },
      { verse: 19, text: 'የዮሐንስ ምስክርነት' },
      { verse: 35, text: 'የመጀመሪያዎቹ ደቀ መዛሙርት' }
    ]
  },
  3: {
    paragraphs: [1, 9, 16, 22],
    subtitles: [
      { verse: 1, text: 'ኢየሱስና ኒቆዲሞስ' }
    ]
  },
};

// Combine all formats
const allFormats: BibleFormat = {
  147: genesisFormat,
  148: exodusFormat,
  169: psalmsFormat,
  193: matthewFormat,
  197: johnFormat,
};

async function updateChapterFormat(bookId: number, chapterNumber: number, format: ChapterFormat) {
  // Get current formatting rules
  const [current] = await sql`
    SELECT formatting_rules
    FROM formatted_chapter_contents 
    WHERE book_id = ${bookId} AND chapter_number = ${chapterNumber}
  `;
  
  if (!current) {
    console.log(`  ⚠️ Chapter not found: Book ${bookId} Chapter ${chapterNumber}`);
    return false;
  }
  
  const rules = current.formatting_rules as any || {};
  
  // Add paragraph breaks and subtitles
  const updatedRules = {
    ...rules,
    paragraphBreaks: format.paragraphs || [],
    subtitles: format.subtitles || [],
  };
  
  await sql`
    UPDATE formatted_chapter_contents 
    SET formatting_rules = ${JSON.stringify(updatedRules)}::jsonb
    WHERE book_id = ${bookId} AND chapter_number = ${chapterNumber}
  `;
  
  return true;
}

async function main() {
  console.log('📝 Setting paragraph breaks and subtitles...\n');
  
  let updated = 0;
  let failed = 0;
  
  for (const [bookIdStr, chapters] of Object.entries(allFormats)) {
    const bookId = parseInt(bookIdStr);
    
    // Get book name
    const [book] = await sql`SELECT name, amharic_name FROM books WHERE id = ${bookId}`;
    console.log(`📖 ${book?.amharic_name || book?.name || `Book ${bookId}`}`);
    
    for (const [chapterStr, format] of Object.entries(chapters)) {
      const chapterNumber = parseInt(chapterStr);
      const success = await updateChapterFormat(bookId, chapterNumber, format);
      
      if (success) {
        console.log(`  ✅ Chapter ${chapterNumber}: ${format.paragraphs?.length || 0} paragraphs, ${format.subtitles?.length || 0} subtitles`);
        updated++;
      } else {
        failed++;
      }
    }
  }
  
  console.log(`\n✅ Updated ${updated} chapters, ${failed} failed`);
}

main().catch(console.error);
