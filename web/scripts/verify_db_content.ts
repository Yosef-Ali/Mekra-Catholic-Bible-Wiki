
import { db } from '../services/db';
import { books, chapterContents as chapters } from '../services/schema';
import { eq } from 'drizzle-orm';

async function verifyBook(bookName: string) {
  try {
    const book = await db.select().from(books).where(eq(books.name, bookName)).limit(1);

    if (book.length === 0) {
      console.log(`❌ Book '${bookName}' not found in database.`);
      return;
    }

    const bookId = book[0].id;
    console.log(`✅ Found '${bookName}' (ID: ${bookId})`);

    const bookChapters = await db.select().from(chapters).where(eq(chapters.bookId, bookId));
    console.log(`📊 Total Chapters in DB: ${bookChapters.length}`);

    // Check Chapter 1 and Last Chapter
    const firstChapter = bookChapters.find(c => c.chapterNumber === 1);
    const lastChapter = bookChapters.sort((a, b) => b.chapterNumber - a.chapterNumber)[0];

    if (firstChapter) console.log(`   - Chapter 1: Present`);
    if (lastChapter) console.log(`   - Last Chapter: ${lastChapter.chapterNumber}`);

  } catch (error) {
    console.error("Error verifying book:", error);
  }
}

const targetBook = process.argv[2] || "Numbers";
console.log(`Verifying ${targetBook}...`);
verifyBook(targetBook);
checkWisdom();

async function checkWisdom() {
  console.log(`Verifying Wisdom...`);
  const book = await db.select().from(books).where(eq(books.name, "Wisdom")).limit(1);

  if (book.length === 0) {
    console.log(`❌ Book 'Wisdom' not found in database.`);
    return;
  }

  const bookId = book[0].id; // 6
  const bookChapters = await db.select().from(chapters).where(eq(chapters.bookId, bookId));
  console.log(`📊 Wisdom Chapters in DB: ${bookChapters.length}`);
}
