import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

// Book mapping: book_id -> formatted file prefix
const bookFileMap = {
  2: '02_Exodus_Amharic.txt',
  17: '17_Tobit_Amharic.txt',
  22: '22_Job_Amharic.txt', 
  28: '28_Sirach_Amharic.txt',
  36: '36_Joel_Amharic.txt',
  51: '51_Acts_Amharic.txt',
  58: '58_Colossians_Amharic.txt',
  63: '63_Titus_Amharic.txt',
  73: '73_Revelation_Amharic.txt'
};

async function extractChapter1(bookId, filename) {
  const filepath = path.join(process.cwd(), 'formatted_books', filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`  ❌ File not found: ${filename}`);
    return null;
  }
  
  const content = fs.readFileSync(filepath, 'utf-8');
  
  // Find Chapter 1 content - look for "ምዕራፍ 1" or "ምዕራፍ 2" to bound it
  const chapter1Regex = /ምዕራፍ\s*1\s*\n([\s\S]*?)(?=ምዕራፍ\s*2\s*\n|$)/i;
  const match = content.match(chapter1Regex);
  
  if (!match) {
    // Try alternate pattern - some books have intro before chapter markers
    const lines = content.split('\n');
    let chapter1Content = [];
    let foundChapter1 = false;
    let foundChapter2 = false;
    
    for (const line of lines) {
      if (line.match(/ምዕራፍ\s*1\s*$/)) {
        foundChapter1 = true;
        continue;
      }
      if (line.match(/ምዕራፍ\s*2\s*$/)) {
        foundChapter2 = true;
        break;
      }
      if (foundChapter1 && !foundChapter2) {
        chapter1Content.push(line);
      }
    }
    
    if (chapter1Content.length > 0) {
      return chapter1Content.join('\n').trim();
    }
    
    console.log(`  ⚠️ Could not find Chapter 1 marker in ${filename}`);
    return null;
  }
  
  return match[1].trim();
}


async function seedMissingChapter1s() {
  console.log('=== Seeding Missing Chapter 1s ===\n');
  
  const missingBooks = [2, 17, 22, 28, 36, 51, 58, 63, 73];
  
  for (const bookId of missingBooks) {
    const filename = bookFileMap[bookId];
    
    // Get book info
    const bookInfo = await sql`SELECT name, amharic_name FROM books WHERE id = ${bookId}`;
    const bookName = bookInfo[0]?.amharic_name || `Book ${bookId}`;
    
    console.log(`\nProcessing Book ${bookId}: ${bookName}`);
    console.log(`  File: ${filename}`);
    
    // Check if chapter 1 already exists
    const existing = await sql`SELECT id FROM chapter_contents WHERE book_id = ${bookId} AND chapter_number = 1`;
    if (existing.length > 0) {
      console.log(`  ✅ Chapter 1 already exists (ID: ${existing[0].id})`);
      continue;
    }
    
    // Extract Chapter 1 from file
    const chapter1Content = await extractChapter1(bookId, filename);
    
    if (!chapter1Content) {
      console.log(`  ❌ Could not extract Chapter 1 content`);
      continue;
    }
    
    console.log(`  📝 Extracted ${chapter1Content.length} chars`);
    
    // Insert into database
    try {
      const result = await sql`
        INSERT INTO chapter_contents (book_id, chapter_number, content, verified)
        VALUES (${bookId}, 1, ${chapter1Content}, 0)
        RETURNING id
      `;
      console.log(`  ✅ Inserted Chapter 1 (ID: ${result[0].id})`);
    } catch (e) {
      console.log(`  ❌ Insert failed: ${e.message}`);
    }
  }
  
  // Verification
  console.log('\n=== Verification ===');
  for (const bookId of missingBooks) {
    const ch = await sql`SELECT id, LENGTH(content) as len FROM chapter_contents WHERE book_id = ${bookId} AND chapter_number = 1`;
    if (ch.length > 0) {
      console.log(`  ✅ Book ${bookId}: Chapter 1 exists (${ch[0].len} chars)`);
    } else {
      console.log(`  ❌ Book ${bookId}: Still missing Chapter 1`);
    }
  }
  
  console.log('\n=== Done ===');
}

seedMissingChapter1s();
