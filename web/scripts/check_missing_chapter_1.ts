import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and, asc } from 'drizzle-orm';

async function checkMissingChapterOne() {
  console.log('Checking for books missing Chapter 1...');

  const allBooks = await db.select().from(books).orderBy(asc(books.id));
  let missingCount = 0;

  for (const book of allBooks) {
    const firstChapter = await db.select()
      .from(chapterContents)
      .where(and(
        eq(chapterContents.bookId, book.id),
        eq(chapterContents.chapterNumber, 1)
      ))
      .limit(1);

    if (firstChapter.length === 0) {
      console.log(`❌ Book ${book.id} (${book.amharicName}) is MISSING Chapter 1`);

      // Check what is the first chapter
      const actualFirst = await db.select()
        .from(chapterContents)
        .where(eq(chapterContents.bookId, book.id))
        .orderBy(asc(chapterContents.chapterNumber))
        .limit(1);

      if (actualFirst.length > 0) {
        console.log(`   -> Starts at Chapter ${actualFirst[0].chapterNumber}`);
      } else {
        console.log(`   -> Has NO chapters`);
      }
      missingCount++;
    }
  }

  console.log(`\nSummary: ${missingCount} books are missing Chapter 1.`);
}

checkMissingChapterOne().catch(console.error);
