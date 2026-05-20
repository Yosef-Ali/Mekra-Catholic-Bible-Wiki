import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function findMissingChaptersAndVerses() {
  console.log('=== Checking Bible for Missing Chapters and Verses ===\n');

  const books = await sql`SELECT * FROM books ORDER BY id`;
  
  let totalMissingChapters = 0;
  let totalMissingVerses = 0;

  for (const book of books) {
    // Get all chapters for the current book
    const chapters = await sql`
      SELECT chapter_number, content
      FROM formatted_chapter_contents
      WHERE book_id = ${book.id}
      ORDER BY chapter_number
    `;

    const expectedNumChapters = book.chapters;
    const foundChapterNumbers = chapters.map(c => c.chapter_number);
    
    // 1. Check for missing chapters
    let missingChapters = [];
    for (let c = 1; c <= expectedNumChapters; c++) {
      if (!foundChapterNumbers.includes(c)) {
        missingChapters.push(c);
        totalMissingChapters++;
      }
    }

    if (missingChapters.length > 0) {
      console.log(`${book.name} (Book ${book.id}): Missing Chapters: ${missingChapters.join(', ')}`);
    }

    // 2. Check for missing verses in found chapters
    for (const chapter of chapters) {
      const content = chapter.content;
      if (!content || !content.sections) continue;

      let verseNumbers = [];
      for (const section of content.sections) {
         if (section.verses) {
           for (const verse of section.verses) {
             if (verse.verse_number) {
               verseNumbers.push(verse.verse_number);
             }
           }
         }
      }

      // Sort unique verse numbers
      verseNumbers = [...new Set(verseNumbers)].sort((a,b) => a - b);
      
      if (verseNumbers.length === 0) {
        console.log(`  ${book.name} Chapter ${chapter.chapter_number}: No verses found.`);
        continue;
      }

      let missingVerses = [];
      let minVerse = verseNumbers[0];
      if (minVerse > 1) {
        // Missing verses at the beginning? We'll assume verse 1 is expected down to minVerse
        for (let v = 1; v < minVerse; v++) {
           missingVerses.push(v);
        }
      }

      let maxVerse = verseNumbers[verseNumbers.length - 1];
      for (let v = minVerse; v <= maxVerse; v++) {
        if (!verseNumbers.includes(v)) {
           missingVerses.push(v);
        }
      }

      if (missingVerses.length > 0) {
        console.log(`  ${book.name} Chapter ${chapter.chapter_number}: Missing Verses: ${missingVerses.join(', ')} (Max verse found: ${maxVerse})`);
        totalMissingVerses += missingVerses.length;
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total missing chapters: ${totalMissingChapters}`);
  console.log(`Total missing verses (within found chapters): ${totalMissingVerses}`);
  console.log('Check complete.');
}

findMissingChaptersAndVerses();
