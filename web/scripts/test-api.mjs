import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function testAPIQuery() {
  console.log('=== Testing API-style Queries ===\n');
  
  // Test query like the chapters route does
  const testCases = [
    { bookId: 1, chapter: 1 },  // Genesis 1
    { bookId: 1, chapter: 5 },  // Genesis 5
    { bookId: 2, chapter: 1 },  // Exodus 1
    { bookId: 73, chapter: 1 }, // Last book
  ];
  
  for (const test of testCases) {
    console.log(`\n--- Testing Book ${test.bookId}, Chapter ${test.chapter} ---`);
    
    const result = await sql`
      SELECT id, book_id, chapter_number, content, verified 
      FROM chapter_contents 
      WHERE book_id = ${test.bookId} AND chapter_number = ${test.chapter}
      LIMIT 1
    `;
    
    if (result.length === 0) {
      console.log('❌ No content found!');
    } else {
      const ch = result[0];
      console.log('✅ Content found:');
      console.log(`   ID: ${ch.id}`);
      console.log(`   Length: ${ch.content?.length || 0} chars`);
      console.log(`   Preview: ${ch.content?.substring(0, 150)}...`);
    }
  }
  
  // Check how many books have complete content
  console.log('\n\n=== Content Coverage ===');
  const coverage = await sql`
    SELECT b.id, b.name, b.amharic_name, b.chapters, 
           COUNT(cc.id) as chapters_filled,
           (b.chapters - COUNT(cc.id)) as missing
    FROM books b
    LEFT JOIN chapter_contents cc ON b.id = cc.book_id
    GROUP BY b.id, b.name, b.amharic_name, b.chapters
    HAVING COUNT(cc.id) < b.chapters
    ORDER BY b.id
    LIMIT 15
  `;
  
  if (coverage.length === 0) {
    console.log('✅ All books have complete chapter content!');
  } else {
    console.log(`Found ${coverage.length} books with missing chapters:`);
    coverage.forEach(b => {
      console.log(`  ${b.id}. ${b.name}: has ${b.chapters_filled}/${b.chapters} chapters (missing ${b.missing})`);
    });
  }
}

testAPIQuery();
