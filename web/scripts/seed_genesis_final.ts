
import fs from 'fs';
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and } from 'drizzle-orm';

// Define interfaces based on the JSON structure
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

interface BookData {
  book_name: string;
  book_name_amharic: string;
  total_chapters: number;
  chapters: Chapter[];
}

interface ExtractionOutput {
  book: BookData;
}

async function seedGenesis() {
  const filePath = './extraction_output/Genesis_extracted.json';

  console.log('\n' + '='.repeat(80));
  console.log('🌱 GENESIS SEEDING - STRUCTURED JSON');
  console.log('='.repeat(80) + '\n');

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log(`📄 Reading: ${filePath}`);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data: ExtractionOutput = JSON.parse(rawData);

    // Basic Validation / Proofreading
    if (!data.book || !data.book.chapters) {
      throw new Error('Invalid JSON structure: missing book or chapters');
    }

    const { book_name, chapters } = data.book;
    console.log(`📘 Processing: ${book_name}`);
    console.log(`📊 Total Chapters in JSON: ${chapters.length}`);

    // Get Book ID from DB
    const dbBook = await db.query.books.findFirst({
      where: eq(books.name, book_name)
    });

    if (!dbBook) {
      throw new Error(`Book "${book_name}" not found in database!`);
    }
    console.log(`✅ Found Book ID: ${dbBook.id}`);

    // Proofreading checks
    console.log('\n🔍 Running consistency checks...');
    let warnings = 0;
    chapters.forEach(chap => {
      if (chap.sections.length === 0) {
        console.warn(`   ⚠️  Chapter ${chap.chapter_number} has no sections`);
        warnings++;
      }
      chap.sections.forEach(sec => {
        if (sec.verses.length === 0) {
          console.warn(`   ⚠️  Chapter ${chap.chapter_number} section "${sec.title}" has no verses`);
          warnings++;
        }
        sec.verses.forEach(v => {
          if (!v.text || v.text.trim().length === 0) {
            console.warn(`   ⚠️  Chapter ${chap.chapter_number} Verse ${v.verse_number} is empty`);
            warnings++;
          }
        });
      });
    });

    if (warnings === 0) {
      console.log('   ✅ No structural warnings found.');
    } else {
      console.log(`   ⚠️ Found ${warnings} warnings (see above). Continuing...`);
    }


    // Delete existing chapters for this book to ensure fresh seed
    console.log(`\n🧹 Clearing existing chapters for ${book_name} (BookID: ${dbBook.id})...`);
    await db.delete(chapterContents)
      .where(eq(chapterContents.bookId, dbBook.id));
    console.log('   ✅ Cleared.');

    // Seed Chapters
    console.log('\n💾 Seeding chapters...');
    let seededCount = 0;

    for (const chapter of chapters) {
      await db.insert(chapterContents).values({
        bookId: dbBook.id,
        chapterNumber: chapter.chapter_number,
        content: chapter, // Storing the full chapter structure as JSON
        verified: 1, // Marking as verified since this comes from the "final" extraction
      });
      process.stdout.write(`\r   ✅ Seeded Chapter ${chapter.chapter_number}`);
      seededCount++;
    }

    console.log(`\n\n🎉 Successfully seeded ${seededCount} chapters for ${book_name}!`);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

seedGenesis();
