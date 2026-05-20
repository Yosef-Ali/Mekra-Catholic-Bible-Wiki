
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq } from 'drizzle-orm';

async function cleanBook(bookName: string) {
  console.log(`🧹 Cleaning ${bookName}...`);
  const book = await db.select().from(books).where(eq(books.name, bookName)).limit(1);

  if (book.length === 0) {
    console.log(`❌ Book '${bookName}' not found.`);
    return;
  }

  const bookId = book[0].id;
  await db.delete(chapterContents).where(eq(chapterContents.bookId, bookId));
  console.log(`✅ Deleted all chapters for ${bookName} (ID: ${bookId})`);
}

const target = process.argv[2];
if (target) {
  cleanBook(target);
} else {
  console.log("Usage: tsx scripts/clean_book.ts <BookName>");
}
