import fs from 'fs';
import { db } from './services/db';
import { books, chapterContents } from './services/schema';
import { eq, and } from 'drizzle-orm';

/**
 * FIXED: Extract Bible chapters from amharic_bible_extracted.txt
 * Uses correct Amharic character patterns
 */

async function seedFromExtracted(filePath: string) {
  console.log('\n' + '='.repeat(80));
  console.log('📖 BIBLE EXTRACTION - FIXED PARSER');
  console.log('='.repeat(80) + '\n');

  try {
    // Read file
    console.log(`📄 Reading: ${filePath}`);
    const text = fs.readFileSync(filePath, 'utf-8');
    const lines = text.split('\n');
    console.log(`✅ Read ${lines.length.toLocaleString()} lines\n`);

    // Get all books
    console.log('📚 Loading books from database...');
    const allBooks = await db.select().from(books);
    console.log(`✅ Loaded ${allBooks.length} books\n`);

    // Build book position map - find where each book starts in the text
    console.log('🔍 Mapping book positions in extracted text...\n');
    
    const bookPositions: Array<{ bookId: number; bookName: string; startPos: number; endPos: number }> = [];
    
    for (let i = 0; i < allBooks.length; i++) {
      const book = allBooks[i];
      const nextBook = allBooks[i + 1];
      
      // Try to find this book in the text
      let startPos = text.indexOf(book.amharicName);
      
      if (startPos === -1) {
        console.log(`⚠️  "${book.amharicName}" not found`);
        continue;
      }
      
      // Find where next book starts (or end of file)
      let endPos = nextBook ? text.indexOf(nextBook.amharicName, startPos + 10) : text.length;
      if (endPos === -1) endPos = text.length;
      
      bookPositions.push({
        bookId: book.id!,
        bookName: book.name,
        startPos,
        endPos
      });
      
      process.stdout.write(`\r  [${((i + 1) / allBooks.length * 100).toFixed(0)}%] ${book.name}...`);
    }
    
    console.log(`\n\n✅ Found ${bookPositions.length} books in extracted text\n`);

    // Now parse chapters for each book
    let totalSeeded = 0;
    let totalFailed = 0;

    for (const bookPos of bookPositions) {
      const book = allBooks.find(b => b.id === bookPos.bookId)!;
      const bookText = text.substring(bookPos.startPos, bookPos.endPos);
      
      console.log(`\n📖 ${book.name}`);
      
      // Find all chapter markers: "ምዕራፍ N" (correct character!)
      const chapterMatches = [...bookText.matchAll(/ምዕራፍ\s+(\d+)/g)];
      
      if (chapterMatches.length === 0) {
        console.log(`   ⚠️  No chapters found (looking for: ምዕራፍ)}`);
        continue;
      }
      
      console.log(`   ✅ Found ${chapterMatches.length} chapters`);
      
      for (let i = 0; i < chapterMatches.length; i++) {
        const match = chapterMatches[i];
        const chapterNum = parseInt(match[1]);
        
        // Get chapter content from this marker to next marker
        const startIdx = match.index!;
        const endIdx = i + 1 < chapterMatches.length 
          ? chapterMatches[i + 1].index! 
          : bookText.length;
        
        let chapterContent = bookText.substring(startIdx, endIdx).trim();
        
        // Remove the chapter marker itself
        chapterContent = chapterContent.replace(/^ምዕራፍ\s+\d+\s*/, '').trim();
        
        if (!chapterContent || chapterContent.length < 10) {
          console.log(`   ⚠️  Chapter ${chapterNum}: Empty/too short`);
          totalFailed++;
          continue;
        }
        
        try {
          // Check if exists
          const existing = await db
            .select()
            .from(chapterContents)
            .where(
              and(
                eq(chapterContents.bookId, bookPos.bookId),
                eq(chapterContents.chapterNumber, chapterNum)
              )
            )
            .limit(1);
          
          if (existing.length > 0) {
            continue; // Skip existing
          }
          
          // Insert
          await db.insert(chapterContents).values({
            bookId: bookPos.bookId,
            chapterNumber: chapterNum,
            content: chapterContent,
            verified: 0, // Mark as unverified
          });
          
          totalSeeded++;
          process.stdout.write(`\r   ✅ ${chapterNum}/${book.chapters || '?'}`);
        } catch (error: any) {
          totalFailed++;
          console.log(`\n   ❌ Error seeding chapter ${chapterNum}: ${error?.message}`);
        }
      }
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('📊 RESULTS');
    console.log('='.repeat(80));
    console.log(`✅ Seeded: ${totalSeeded} chapters`);
    console.log(`❌ Failed: ${totalFailed} chapters`);
    console.log('='.repeat(80) + '\n');

    if (totalSeeded > 0) {
      console.log('🎉 SUCCESS! Chapters extracted and seeded!\n');
      console.log('Next: pnpm db:studio (verify chapter_contents table)\n');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

// Run
seedFromExtracted('./amharic_bible_extracted.txt').catch((err) => {
  console.error(err);
  process.exit(1);
});
