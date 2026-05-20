import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const EXTRACTION_DIR = path.join(process.cwd(), 'extraction_output');

// Map extracted file names to database book names
const NAME_MAPPING: Record<string, string> = {
  // Books with underscores -> spaces
  '1_Samuel': '1 Samuel',
  '2_Samuel': '2 Samuel',
  '1_Kings': '1 Kings',
  '2_Kings': '2 Kings',
  '1_Chronicles': '1 Chronicles',
  '2_Chronicles': '2 Chronicles',
  '1_Maccabees': '1 Maccabees',
  '2_Maccabees': '2 Maccabees',
  '1_Corinthians': '1 Corinthians',
  '2_Corinthians': '2 Corinthians',
  '1_Thessalonians': '1 Thessalonians',
  '2_Thessalonians': '2 Thessalonians',
  '1_Timothy': '1 Timothy',
  '2_Timothy': '2 Timothy',
  '1_Peter': '1 Peter',
  '2_Peter': '2 Peter',
  '1_John': '1 John',
  '2_John': '2 John',
  '3_John': '3 John',
  // Different names
  'Song_of_Songs': 'Song of Solomon',
  'Wisdom': 'Wisdom of Solomon',
};

interface Verse {
  verse_number: number;
  text: string;
}

interface Section {
  title: string;
  verses: Verse[];
}

interface Chapter {
  chapter_number: number;
  sections: Section[];
}

interface ExtractedBook {
  book: {
    book_name: string;
    book_name_amharic: string;
    total_chapters: number;
    chapters: Chapter[];
  };
}

async function seedAllBooks() {
  console.log('📖 Starting comprehensive Bible seeding...\n');
  
  // Get all extracted JSON files
  const files = fs.readdirSync(EXTRACTION_DIR)
    .filter(f => f.endsWith('_extracted.json'))
    .sort();
  
  console.log(`Found ${files.length} extracted book files\n`);
  console.log('='.repeat(70));
  console.log(`${'Book'.padEnd(25)} ${'DB Match'.padEnd(25)} ${'Ch'.padStart(5)} ${'Verses'.padStart(8)}`);
  console.log('='.repeat(70));
  
  let totalSeeded = 0;
  let totalFailed = 0;
  let totalChapters = 0;
  let totalVerses = 0;
  
  for (const file of files) {
    const filePath = path.join(EXTRACTION_DIR, file);
    const extractedName = file.replace('_extracted.json', '');
    
    // Get the database name (with mapping if needed)
    const dbName = NAME_MAPPING[extractedName] || extractedName;
    
    try {
      // Read and parse JSON
      const content = fs.readFileSync(filePath, 'utf-8');
      const data: ExtractedBook = JSON.parse(content);
      
      if (!data.book || !data.book.chapters) {
        console.log(`❌ ${extractedName.padEnd(25)} Invalid JSON structure`);
        totalFailed++;
        continue;
      }
      
      // Find book in database using multiple matching strategies
      let bookRecord = await db.query.books.findFirst({
        where: (books, { eq }) => eq(books.name, dbName)
      });
      
      // Try with extracted name if not found
      if (!bookRecord) {
        bookRecord = await db.query.books.findFirst({
          where: (books, { eq }) => eq(books.name, extractedName)
        });
      }
      
      // Try with Amharic name
      if (!bookRecord) {
        bookRecord = await db.query.books.findFirst({
          where: (books, { eq }) => eq(books.amharicName, data.book.book_name_amharic)
        });
      }
      
      if (!bookRecord) {
        console.log(`❌ ${extractedName.padEnd(25)} NOT IN DATABASE`);
        totalFailed++;
        continue;
      }
      
      // Clear existing content for this book
      await db.delete(chapterContents).where(eq(chapterContents.bookId, bookRecord.id));
      
      // Insert each chapter
      let chaptersInserted = 0;
      let versesInserted = 0;
      
      for (const chapter of data.book.chapters) {
        // Convert sections/verses to content format
        const chapterContent = {
          sections: chapter.sections.map(sec => ({
            title: sec.title || '',
            verses: sec.verses.map(v => ({
              number: v.verse_number,
              text: v.text
            }))
          }))
        };
        
        const verseCount = chapter.sections.reduce((sum, sec) => sum + sec.verses.length, 0);
        
        await db.insert(chapterContents).values({
          bookId: bookRecord.id,
          chapterNumber: chapter.chapter_number,
          content: chapterContent,
          style: 'prose',
          verified: 1,
        });
        
        chaptersInserted++;
        versesInserted += verseCount;
      }
      
      console.log(`✅ ${extractedName.padEnd(25)} ${bookRecord.name.padEnd(25)} ${chaptersInserted.toString().padStart(5)} ${versesInserted.toString().padStart(8)}`);
      totalSeeded++;
      totalChapters += chaptersInserted;
      totalVerses += versesInserted;
      
    } catch (error: any) {
      console.log(`❌ ${extractedName.padEnd(25)} ERROR: ${error.message.slice(0, 30)}`);
      totalFailed++;
    }
  }
  
  console.log('='.repeat(70));
  console.log(`\n📊 SEEDING COMPLETE`);
  console.log(`   ✅ Books seeded: ${totalSeeded}`);
  console.log(`   ❌ Books failed: ${totalFailed}`);
  console.log(`   📖 Total chapters: ${totalChapters}`);
  console.log(`   📝 Total verses: ${totalVerses}`);
  console.log('='.repeat(70));
  
  process.exit(0);
}

seedAllBooks().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
