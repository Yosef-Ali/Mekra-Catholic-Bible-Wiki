/**
 * Diagnostic script to check formatting status
 */
import { config } from 'dotenv';
import { db } from '../services/db';
import { chapterContents, books } from '../services/schema';
import { eq, isNull, sql, and } from 'drizzle-orm';

config();

async function diagnose() {
  console.log('📊 Checking Bible formatting status...\n');

  // Get total chapters
  const total = await db.select({ count: sql<number>`count(*)` }).from(chapterContents);
  console.log(`Total chapters in database: ${total[0].count}`);

  // Get chapters with formatting rules
  const withRules = await db
    .select({ count: sql<number>`count(*)` })
    .from(chapterContents)
    .where(sql`formatting_rules IS NOT NULL`);
  console.log(`Chapters WITH formatting rules: ${withRules[0].count}`);

  // Get chapters without formatting rules
  const withoutRules = await db
    .select({ count: sql<number>`count(*)` })
    .from(chapterContents)
    .where(isNull(chapterContents.formattingRules));
  console.log(`Chapters WITHOUT formatting rules: ${withoutRules[0].count}`);

  // Get detailed breakdown by book for missing formatting
  const missingByBook = await db
    .select({
      bookId: chapterContents.bookId,
      bookName: books.name,
      amharicName: books.amharicName,
      chapterNumber: chapterContents.chapterNumber
    })
    .from(chapterContents)
    .leftJoin(books, eq(chapterContents.bookId, books.id))
    .where(isNull(chapterContents.formattingRules))
    .orderBy(chapterContents.bookId, chapterContents.chapterNumber);

  if (missingByBook.length > 0) {
    console.log(`\n📋 Chapters missing formatting rules:\n`);
    
    // Group by book
    const byBook: Record<number, { name: string; amharic: string; chapters: number[] }> = {};
    missingByBook.forEach(row => {
      if (!byBook[row.bookId]) {
        byBook[row.bookId] = {
          name: row.bookName || 'Unknown',
          amharic: row.amharicName || '',
          chapters: []
        };
      }
      byBook[row.bookId].chapters.push(row.chapterNumber);
    });

    Object.entries(byBook).forEach(([bookId, info]) => {
      console.log(`📖 ${info.amharic} (${info.name}) [ID: ${bookId}]`);
      console.log(`   Missing: ${info.chapters.length} chapters`);
      console.log(`   Chapters: ${info.chapters.sort((a,b) => a-b).join(', ')}\n`);
    });
  } else {
    console.log('\n✅ All chapters have formatting rules!');
  }

  // Check Genesis 3 (known to have poetry)
  console.log('\n🔍 Checking Genesis 3 (should have poetry in verses 14-19)...');
  const [genesis3] = await db
    .select()
    .from(chapterContents)
    .where(and(
      eq(chapterContents.bookId, 147),
      eq(chapterContents.chapterNumber, 3)
    ));

  if (genesis3) {
    const rules = genesis3.formattingRules as any;
    if (rules) {
      console.log('   ✅ Has formatting rules');
      console.log(`   Poetry: ${rules.hasPoetry ? 'Yes' : 'No'}`);
      console.log(`   Sections: ${JSON.stringify(rules.sections?.slice(0, 3), null, 2)}...`);
    } else {
      console.log('   ❌ No formatting rules - needs fixing');
    }
  } else {
    console.log('   ⚠️ Genesis 3 not found in database');
  }
}

diagnose().catch(console.error);
