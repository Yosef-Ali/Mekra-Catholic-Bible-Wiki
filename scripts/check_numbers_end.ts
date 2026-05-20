
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and } from 'drizzle-orm';

async function checkNumbersEnd() {
  const book = await db.select().from(books).where(eq(books.name, "Numbers")).limit(1);
  if (!book.length) return;

  const lastChapter = await db.select().from(chapterContents)
    .where(and(eq(chapterContents.bookId, book[0].id), eq(chapterContents.chapterNumber, 36)))
    .limit(1);

  if (lastChapter.length) {
    const content = lastChapter[0].content as any;
    console.log("Structure:", JSON.stringify(content).substring(0, 200));
    // Handle if content is array or object wrapped
    const items = Array.isArray(content) ? content : (content.content || content.items || []);
    const verses = items.filter((i: any) => i.type === 'verse');

    console.log(`Numbers Ch 36 Verse Count: ${verses.length}`);
    console.log(`Last Verse: ${JSON.stringify(verses[verses.length - 1])}`);
  } else {
    console.log("Numbers Ch 36 not found");
  }
}

checkNumbersEnd();
