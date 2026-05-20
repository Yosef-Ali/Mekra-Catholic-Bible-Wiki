import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, sql, asc } from 'drizzle-orm';

async function checkSeededDetails() {
  console.log('📊 Checking Seeded Database Details...\n');

  // Get all books with their chapter counts
  const allBooks = await db.select({
    id: books.id,
    name: books.name,
    amharicName: books.amharicName,
    chapters: books.chapters
  })
  .from(books)
  .orderBy(asc(books.id));

  console.log(`📚 Total Books in Database: ${allBooks.length}\n`);
  console.log('='.repeat(90));
  
  let totalSeededChapters = 0;
  let totalExpectedChapters = 0;
  let fullySeeded = 0;
  let partiallySeeded = 0;
  let notSeeded = 0;

  for (const book of allBooks) {
    // Get chapter count for this book
    const seededChapters = await db.select({ count: sql<number>`count(*)` })
      .from(chapterContents)
      .where(eq(chapterContents.bookId, book.id));
    
    const seededCount = Number(seededChapters[0].count);
    totalSeededChapters += seededCount;
    totalExpectedChapters += book.chapters;
    
    const status = seededCount === book.chapters ? '✅' : seededCount > 0 ? '⚠️' : '❌';
    
    if (seededCount === book.chapters) fullySeeded++;
    else if (seededCount > 0) partiallySeeded++;
    else notSeeded++;
    
    const bookInfo = `${status} ${book.name.padEnd(25)} (${book.amharicName || 'N/A'})`.padEnd(60);
    console.log(`${bookInfo} | Seeded: ${String(seededCount).padStart(3)}/${String(book.chapters).padStart(3)} chapters`);
  }

  console.log('='.repeat(90));
  console.log(`\n📈 SUMMARY:`);
  console.log(`   ✅ Fully Seeded: ${fullySeeded} books`);
  console.log(`   ⚠️ Partially Seeded: ${partiallySeeded} books`);
  console.log(`   ❌ Not Seeded: ${notSeeded} books`);
  console.log(`   📄 Total Chapters: ${totalSeededChapters}/${totalExpectedChapters}`);
}

checkSeededDetails().catch(console.error);
