import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function analyzeChapterNumbers() {
  console.log('=== Analyzing Chapter Numbers for Each Book ===\n');
  
  const books = await sql`SELECT id, name, amharic_name, chapters FROM books ORDER BY id`;
  
  for (const book of books.slice(0, 20)) { // Check first 20 books
    const chapters = await sql`
      SELECT MIN(chapter_number) as min_ch, MAX(chapter_number) as max_ch, COUNT(*) as total
      FROM chapter_contents 
      WHERE book_id = ${book.id}
    `;
    
    const ch = chapters[0];
    const expectedChapters = book.chapters;
    const hasChapter1 = ch.min_ch === 1;
    const status = hasChapter1 ? '✅' : '❌ Missing Ch 1';
    
    console.log(`${book.id}. ${book.name.padEnd(15)} | Expected: ${expectedChapters.toString().padStart(2)} | Found: ${ch.total.toString().padStart(2)} | Range: ${ch.min_ch}-${ch.max_ch} ${status}`);
  }
  
  // Check for chapter 1 in Exodus specifically
  console.log('\n=== Exodus Chapter 1 & 2 Content Preview ===');
  const exodusContent = await sql`
    SELECT chapter_number, LEFT(content, 200) as preview
    FROM chapter_contents 
    WHERE book_id = 2 AND chapter_number IN (1, 2)
    ORDER BY chapter_number
  `;
  
  exodusContent.forEach(ch => {
    console.log(`\nChapter ${ch.chapter_number}:`);
    console.log(ch.preview);
  });
}

analyzeChapterNumbers();
