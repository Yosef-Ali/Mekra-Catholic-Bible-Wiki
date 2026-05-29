import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function checkDatabase() {
  try {
    // Check books
    const books = await sql`SELECT COUNT(*) as count FROM books`;
    console.log('Total books in database:', books[0].count);
    
    // Check chapter_contents
    const chapters = await sql`SELECT COUNT(*) as count FROM chapter_contents`;
    console.log('Total chapters in database:', chapters[0].count);
    
    // Sample chapters with content
    const sampleChapters = await sql`SELECT book_id, chapter_number, LENGTH(content) as content_length FROM chapter_contents ORDER BY book_id, chapter_number LIMIT 15`;
    console.log('\nSample chapters (bookId, chapterNum, contentLength):');
    sampleChapters.forEach(ch => {
      console.log(`  Book ${ch.book_id}, Chapter ${ch.chapter_number}: ${ch.content_length} chars`);
    });
    
    // Books with content
    const booksWithContent = await sql`SELECT DISTINCT book_id FROM chapter_contents ORDER BY book_id`;
    console.log('\nBooks with content (IDs):', booksWithContent.map(b => b.book_id));
    
    // First 5 books
    const firstBooks = await sql`SELECT id, name, amharic_name, chapters, section FROM books LIMIT 5`;
    console.log('\nFirst 5 books:');
    firstBooks.forEach(b => {
      console.log(`  ${b.id}: ${b.name} (${b.amharic_name}) - ${b.chapters} chapters [${b.section}]`);
    });
    
  } catch (e) {
    console.error('Error:', e.message);
  }
}

checkDatabase();
