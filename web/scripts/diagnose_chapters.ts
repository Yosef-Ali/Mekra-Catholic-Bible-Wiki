
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, count } from 'drizzle-orm';

async function diagnose() {
  console.log('🔍 Diagnosing Database Chapters...');

  try {
    const allBooks = await db.select().from(books);
    console.log(`📚 Found ${allBooks.length} books in logic.`);

    for (const book of allBooks) {
      const result = await db
        .select({ count: count() })
        .from(chapterContents)
        .where(eq(chapterContents.bookId, book.id));

      const actualCount = result[0].count;

      if (actualCount !== book.chapters) {
        console.error(`❌ [${book.id}] ${book.name} (${book.amharicName}): Expected ${book.chapters}, Found ${actualCount}`);

        // Check which ones are missing
        const existingChapters = await db
          .select({ num: chapterContents.chapterNumber })
          .from(chapterContents)
          .where(eq(chapterContents.bookId, book.id));

        const existingSet = new Set(existingChapters.map(c => c.num));
        const missing = [];
        for (let i = 1; i <= book.chapters; i++) {
          if (!existingSet.has(i)) missing.push(i);
        }
        if (missing.length > 0) {
          console.log(`   ⚠️ Missing Chapters: ${missing.join(', ')}`);
        }
      } else {
        // console.log(`✅ [${book.id}] ${book.name}: All ${actualCount} chapters present.`);
      }
    }
    console.log('🏁 Diagnosis Complete.');
  } catch (error) {
    console.error('Diagnosis failed:', error);
  }
}

diagnose();
