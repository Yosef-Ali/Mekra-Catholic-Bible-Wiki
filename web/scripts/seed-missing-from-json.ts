import fs from 'fs';
import path from 'path';
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Seed missing chapters from extracted JSON files
 */

// Map of book names to their JSON filenames
const BOOK_TO_FILE: Record<string, string> = {
  // Minor Prophets
  'Daniel': 'Daniel_extracted.json',
  'Hosea': 'Hosea_extracted.json',
  'Joel': 'Joel_extracted.json',
  'Amos': 'Amos_extracted.json',
  'Obadiah': 'Obadiah_extracted.json',
  'Jonah': 'Jonah_extracted.json',
  'Micah': 'Micah_extracted.json',
  'Nahum': 'Nahum_extracted.json',
  'Habakkuk': 'Habakkuk_extracted.json',
  'Zephaniah': 'Zephaniah_extracted.json',
  'Haggai': 'Haggai_extracted.json',
  'Zechariah': 'Zechariah_extracted.json',
  'Malachi': 'Malachi_extracted.json',
  // NT Gospels & Acts
  'Matthew': 'Matthew_extracted.json',
  'Mark': 'Mark_extracted.json',
  'Luke': 'Luke_extracted.json',
  'John': 'John_extracted.json',
  'Acts': 'Acts_extracted.json',
  // Pauline Epistles
  'Romans': 'Romans_extracted.json',
  '1 Corinthians': '1_Corinthians_extracted.json',
  '2 Corinthians': '2_Corinthians_extracted.json',
  'Galatians': 'Galatians_extracted.json',
  'Ephesians': 'Ephesians_extracted.json',
  'Philippians': 'Philippians_extracted.json',
  'Colossians': 'Colossians_extracted.json',
  '1 Thessalonians': '1_Thessalonians_extracted.json',
  '2 Thessalonians': '2_Thessalonians_extracted.json',
  '1 Timothy': '1_Timothy_extracted.json',
  '2 Timothy': '2_Timothy_extracted.json',
  'Titus': 'Titus_extracted.json',
  'Philemon': 'Philemon_extracted.json',
  'Hebrews': 'Hebrews_extracted.json',
  // General Epistles & Revelation
  'James': 'James_extracted.json',
  '1 Peter': '1_Peter_extracted.json',
  '2 Peter': '2_Peter_extracted.json',
  '1 John': '1_John_extracted.json',
  '2 John': '2_John_extracted.json',
  '3 John': '3_John_extracted.json',
  'Jude': 'Jude_extracted.json',
  'Revelation': 'Revelation_extracted.json',
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


/**
 * Convert chapter data (sections/verses) to a single content string
 */
function chapterToContent(chapter: Chapter): string {
  let content = '';
  
  for (const section of chapter.sections) {
    // Add section title if present
    if (section.title && section.title.trim()) {
      content += `\n${section.title}\n`;
    }
    
    // Add verses with [n] format
    for (const verse of section.verses) {
      content += `[${verse.verse_number}] ${verse.text} `;
    }
  }
  
  return content.trim();
}

/**
 * Main seeding function
 */
async function seedMissingFromJson() {
  const extractionDir = path.join(process.cwd(), 'extraction_output');
  
  console.log('📖 Seeding Missing Books from Extracted JSON Files...\n');
  console.log(`📁 Reading from: ${extractionDir}\n`);
  
  // Get all books from database
  const dbBooks = await db.select().from(books);
  const bookIdMap = new Map(dbBooks.map(b => [b.name, { id: b.id!, chapters: b.chapters }]));
  
  let totalSeeded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  
  // Process each book that needs seeding
  for (const [bookName, jsonFile] of Object.entries(BOOK_TO_FILE)) {
    const bookInfo = bookIdMap.get(bookName);
    if (!bookInfo) {
      console.log(`❌ Book "${bookName}" not found in database`);
      continue;
    }
    
    // Check how many chapters are already seeded
    const existingCount = await db.select({ count: sql<number>`count(*)` })
      .from(chapterContents)
      .where(eq(chapterContents.bookId, bookInfo.id));
    
    const seededCount = Number(existingCount[0].count);
    if (seededCount === bookInfo.chapters) {
      console.log(`✅ ${bookName} - Already fully seeded (${seededCount}/${bookInfo.chapters})`);
      totalSkipped += bookInfo.chapters;
      continue;
    }
    
    console.log(`\n📚 ${bookName} - Seeding missing chapters (${seededCount}/${bookInfo.chapters} exist)`);
    
    // Read the JSON file
    const jsonPath = path.join(extractionDir, jsonFile);
    if (!fs.existsSync(jsonPath)) {
      console.log(`   ❌ JSON file not found: ${jsonPath}`);
      totalFailed += bookInfo.chapters - seededCount;
      continue;
    }
    
    try {
      const data: ExtractedBook = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      
      // Process each chapter
      for (const chapter of data.book.chapters) {
        // Check if chapter already exists
        const existing = await db.select()
          .from(chapterContents)
          .where(and(
            eq(chapterContents.bookId, bookInfo.id),
            eq(chapterContents.chapterNumber, chapter.chapter_number)
          ))
          .limit(1);
        
        if (existing.length > 0) {
          continue; // Skip existing
        }
        
        // Convert chapter to content string
        const content = chapterToContent(chapter);
        
        if (!content || content.length < 10) {
          console.log(`   ⚠️ Chapter ${chapter.chapter_number}: No content`);
          totalFailed++;
          continue;
        }
        
        // Insert to database
        await db.insert(chapterContents).values({
          bookId: bookInfo.id,
          chapterNumber: chapter.chapter_number,
          content,
          verified: 0,
        });
        
        totalSeeded++;
        process.stdout.write(`   ✓ Ch ${chapter.chapter_number} `);
      }
      console.log();
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      totalFailed += bookInfo.chapters - seededCount;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SEEDING SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Chapters seeded: ${totalSeeded}`);
  console.log(`⏭️  Chapters skipped: ${totalSkipped}`);
  console.log(`❌ Chapters failed: ${totalFailed}`);
  console.log('='.repeat(60));
}

// Run the script
seedMissingFromJson()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
