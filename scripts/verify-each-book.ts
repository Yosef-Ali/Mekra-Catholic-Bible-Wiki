import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, sql } from 'drizzle-orm';

async function verifyEachBook() {
  console.log('🔍 VERIFYING REMOTE DATABASE - DETAILED CHECK\n');
  console.log(`📡 Database: ${process.env.DATABASE_URL?.substring(0, 60)}...\n`);

  // Get all books
  const allBooks = await db.select().from(books).orderBy(books.id);

  console.log('Checking each book:\n');

  for (const book of allBooks.slice(0, 15)) { // First 15 books
    // Count chapters for this book
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(chapterContents)
      .where(eq(chapterContents.bookId, book.id!));

    const count = Number(result[0].count);
    const expected = book.chapters;
    const status = count === expected ? '✅' : count > 0 ? '⚠️ ' : '❌';

    console.log(`${status} ${book.name.padEnd(20)} ${count}/${expected} chapters`);

    // If has chapters, show first chapter snippet
    if (count > 0) {
      const sample = await db
        .select()
        .from(chapterContents)
        .where(eq(chapterContents.bookId, book.id!))
        .limit(1);

      if (sample[0]) {
        console.log(`   📝 Sample: ${sample[0].content.substring(0, 60).replace(/\n/g, ' ')}...`);
      }
    }
  }

  // Total count
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(chapterContents);

  console.log(`\n📊 TOTAL CHAPTERS IN REMOTE DB: ${totalResult[0].count}`);
}

verifyEachBook().catch(console.error);
