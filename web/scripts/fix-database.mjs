import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function fixDatabase() {
  console.log('=== Starting Database Fix ===\n');

  try {
    // Step 1: Find all books
    const books = await sql`SELECT id, name, amharic_name, chapters FROM books ORDER BY id`;
    console.log(`Total books: ${books.length}\n`);

    // Step 2: Find books missing Chapter 1
    console.log('--- Books Missing Chapter 1 ---');
    const missingChapter1 = [];
    
    for (const book of books) {
      const chapter1 = await sql`
        SELECT id, book_id, chapter_number, LENGTH(content) as content_length
        FROM chapter_contents 
        WHERE book_id = ${book.id} AND chapter_number = 1
      `;
      
      if (chapter1.length === 0) {
        missingChapter1.push(book);
        console.log(`❌ Book ${book.id}: ${book.name} (${book.amharic_name}) - NO Chapter 1`);
      }
    }
    
    console.log(`\nBooks missing Chapter 1: ${missingChapter1.length}\n`);

    // Step 3: Find and remove duplicates (keep the one with most content)
    console.log('--- Removing Duplicates ---');
    
    const duplicates = await sql`
      SELECT book_id, chapter_number, COUNT(*) as count
      FROM chapter_contents
      GROUP BY book_id, chapter_number
      HAVING COUNT(*) > 1
    `;
    
    console.log(`Found ${duplicates.length} duplicate chapter sets\n`);

    let removedCount = 0;
    for (const dup of duplicates) {
      // Get all versions of this chapter
      const versions = await sql`
        SELECT id, LENGTH(content) as content_length
        FROM chapter_contents
        WHERE book_id = ${dup.book_id} AND chapter_number = ${dup.chapter_number}
        ORDER BY content_length DESC
      `;
      
      // Keep the first one (longest content), delete the rest
      const keepId = versions[0].id;
      const deleteIds = versions.slice(1).map(v => v.id);
      
      if (deleteIds.length > 0) {
        await sql`DELETE FROM chapter_contents WHERE id = ANY(${deleteIds})`;
        removedCount += deleteIds.length;
        console.log(`  Book ${dup.book_id}, Chapter ${dup.chapter_number}: Kept ID ${keepId} (${versions[0].content_length} chars), removed ${deleteIds.length} duplicates`);
      }
    }
    
    console.log(`\n✅ Removed ${removedCount} duplicate entries\n`);

    // Step 4: Verify fix
    console.log('--- Verification ---');
    const finalCount = await sql`SELECT COUNT(*) as count FROM chapter_contents`;
    console.log(`Total chapters after cleanup: ${finalCount[0].count}`);

    // Re-check for missing chapter 1s
    const stillMissing = [];
    for (const book of books) {
      const ch1 = await sql`SELECT id FROM chapter_contents WHERE book_id = ${book.id} AND chapter_number = 1`;
      if (ch1.length === 0) {
        stillMissing.push(book);
      }
    }
    
    if (stillMissing.length > 0) {
      console.log(`\n⚠️ Books still missing Chapter 1 (${stillMissing.length}):`);
      stillMissing.forEach(b => console.log(`  - ${b.id}: ${b.name}`));
    } else {
      console.log('\n✅ All books now have Chapter 1!');
    }

    console.log('\n=== Database Fix Complete ===');

  } catch (e) {
    console.error('Error:', e.message);
  }
}

fixDatabase();
