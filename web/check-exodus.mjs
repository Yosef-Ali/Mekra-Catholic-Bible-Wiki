import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function checkExodus() {
  console.log('=== Checking Exodus (Book 2) ===\n');
  
  // Check book info
  const book = await sql`SELECT * FROM books WHERE id = 2`;
  console.log('Book 2 info:', book[0]);
  
  // Check what chapters exist for book 2
  const chapters = await sql`
    SELECT chapter_number, LENGTH(content) as len 
    FROM chapter_contents 
    WHERE book_id = 2
    ORDER BY chapter_number
  `;
  console.log(`\nChapters found for Book 2: ${chapters.length}`);
  if (chapters.length > 0) {
    console.log('Available chapters:', chapters.map(c => c.chapter_number).join(', '));
  }
  
  // Check book 73
  console.log('\n=== Checking Book 73 ===');
  const book73 = await sql`SELECT * FROM books WHERE id = 73`;
  console.log('Book 73 info:', book73[0]);
  
  const chapters73 = await sql`
    SELECT chapter_number, LENGTH(content) as len 
    FROM chapter_contents 
    WHERE book_id = 73
    ORDER BY chapter_number
  `;
  console.log(`Chapters found: ${chapters73.length}`);
  if (chapters73.length > 0) {
    console.log('Available chapters:', chapters73.map(c => c.chapter_number).join(', '));
  }
  
  // Check if there's content that might be misassigned
  console.log('\n=== Checking for misassigned content ===');
  const contentPreview = await sql`
    SELECT cc.id, cc.book_id, cc.chapter_number, LEFT(cc.content, 100) as preview,
           b.name as book_name, b.amharic_name
    FROM chapter_contents cc
    JOIN books b ON cc.book_id = b.id
    WHERE cc.chapter_number = 1
    ORDER BY cc.book_id
    LIMIT 20
  `;
  
  console.log('\nFirst 20 books with Chapter 1:');
  contentPreview.forEach(c => {
    console.log(`${c.book_id}. ${c.book_name}: ${c.preview?.substring(0, 60)}...`);
  });
}

checkExodus();
