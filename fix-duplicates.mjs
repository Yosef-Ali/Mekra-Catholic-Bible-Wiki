import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function fixDuplicates() {
  try {
    console.log('=== Fixing Duplicate Chapters ===\n');
    
    // Step 1: Find all duplicates
    const duplicates = await sql`
      SELECT book_id, chapter_number, COUNT(*) as count 
      FROM chapter_contents 
      GROUP BY book_id, chapter_number 
      HAVING COUNT(*) > 1
    `;
    
    console.log(`Found ${duplicates.length} chapter(s) with duplicates\n`);
    
    let totalRemoved = 0;
    
    // Step 2: For each duplicate, keep the one with longest content
    for (const dup of duplicates) {
      const { book_id, chapter_number } = dup;
      
      // Get all entries for this chapter
      const entries = await sql`
        SELECT id, LENGTH(content) as len 
        FROM chapter_contents 
        WHERE book_id = ${book_id} AND chapter_number = ${chapter_number}
        ORDER BY LENGTH(content) DESC
      `;
      
      // Keep the longest one (first after ORDER BY DESC)
      const keepId = entries[0].id;
      const idsToDelete = entries.slice(1).map(e => e.id);
      
      console.log(`Book ${book_id}, Chapter ${chapter_number}:`);
      console.log(`  Keeping ID ${keepId} (${entries[0].len} chars)`);
      console.log(`  Deleting IDs: ${idsToDelete.join(', ')} (shorter duplicates)`);
      
      // Delete the duplicates
      for (const id of idsToDelete) {
        await sql`DELETE FROM chapter_contents WHERE id = ${id}`;
        totalRemoved++;
      }
    }
    
    console.log(`\n✅ Removed ${totalRemoved} duplicate entries`);
    
    // Step 3: Verify the fix
    const remaining = await sql`
      SELECT book_id, chapter_number, COUNT(*) as count 
      FROM chapter_contents 
      GROUP BY book_id, chapter_number 
      HAVING COUNT(*) > 1
    `;
    
    console.log(`\nVerification: ${remaining.length} duplicates remaining (should be 0)`);
    
    // Step 4: Check total chapters now
    const total = await sql`SELECT COUNT(*) as c FROM chapter_contents`;
    console.log(`Total chapters in database: ${total[0].c}`);
    
  } catch (e) {
    console.error('Error:', e);
  }
}

fixDuplicates();
