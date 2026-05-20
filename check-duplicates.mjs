import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function checkDuplicates() {
  try {
    // Check for duplicate chapters
    const duplicates = await sql`
      SELECT book_id, chapter_number, COUNT(*) as count 
      FROM chapter_contents 
      GROUP BY book_id, chapter_number 
      HAVING COUNT(*) > 1
      ORDER BY book_id, chapter_number
    `;
    console.log('Duplicate chapters found:', duplicates.length);
    if (duplicates.length > 0) {
      console.log('Duplicates:');
      duplicates.forEach(d => {
        console.log(`  Book ${d.book_id}, Chapter ${d.chapter_number}: ${d.count} copies`);
      });
    }

    // Test a specific chapter query (similar to API)
    console.log('\n--- Testing API-style query for Book 1, Chapter 1 ---');
    const result = await sql`
      SELECT id, book_id, chapter_number, LENGTH(content) as len, content
      FROM chapter_contents
      WHERE book_id = 1 AND chapter_number = 1
      LIMIT 2
    `;
    console.log('Results found:', result.length);
    result.forEach((ch, i) => {
      console.log(`\nResult ${i + 1}:`);
      console.log(`  ID: ${ch.id}`);
      console.log(`  Content length: ${ch.len} chars`);
      console.log(`  Content preview: ${ch.content?.substring(0, 200)}...`);
    });

    // Check books table
    console.log('\n--- Checking books table ---');
    const booksCount = await sql`SELECT COUNT(*) as c FROM books`;
    console.log('Total books:', booksCount[0].c);

    // Find books with missing content
    console.log('\n--- Books without any content ---');
    const booksWithoutContent = await sql`
      SELECT b.id, b.name, b.amharic_name, b.chapters 
      FROM books b 
      LEFT JOIN chapter_contents cc ON b.id = cc.book_id 
      WHERE cc.id IS NULL
    `;
    console.log('Books without content:', booksWithoutContent.length);
    booksWithoutContent.forEach(b => {
      console.log(`  ${b.id}: ${b.name} (${b.amharic_name})`);
    });

  } catch (e) {
    console.error('Error:', e);
  }
}

checkDuplicates();
