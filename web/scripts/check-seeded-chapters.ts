import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, sql } from 'drizzle-orm';

async function checkSeededChapters() {
  console.log('📊 Checking seeded chapters status...\n');

  try {
    // Get all books with chapter counts
    const allBooks = await db.select().from(books).orderBy(books.id);

    // Get count of seeded chapters per book
    const seededCounts = await db
      .select({
        bookId: chapterContents.bookId,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(chapterContents)
      .groupBy(chapterContents.bookId);

    const countMap = new Map(seededCounts.map(s => [s.bookId, Number(s.count)]));

    console.log('='.repeat(80));
    console.log('📚 SEEDED CHAPTERS STATUS');
    console.log('='.repeat(80));

    let totalExpected = 0;
    let totalSeeded = 0;
    let completeBooks = 0;
    let partialBooks = 0;
    let emptyBooks = 0;

    for (const book of allBooks) {
      const expected = book.chapters;
      const seeded = countMap.get(book.id!) || 0;
      const status = seeded === expected ? '✅' : seeded > 0 ? '⚠️ ' : '❌';
      const percentage = expected > 0 ? ((seeded / expected) * 100).toFixed(0) : '0';

      console.log(`${status} [${book.id!.toString().padStart(2)}] ${book.name.padEnd(25)} ${seeded.toString().padStart(3)}/${expected.toString().padEnd(3)} (${percentage}%)`);

      totalExpected += expected;
      totalSeeded += seeded;

      if (seeded === expected) completeBooks++;
      else if (seeded > 0) partialBooks++;
      else emptyBooks++;
    }

    console.log('='.repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`Total chapters seeded: ${totalSeeded}/${totalExpected} (${((totalSeeded / totalExpected) * 100).toFixed(1)}%)`);
    console.log(`✅ Complete books: ${completeBooks}/73`);
    console.log(`⚠️  Partial books: ${partialBooks}/73`);
    console.log(`❌ Empty books: ${emptyBooks}/73`);
    console.log('');

    // Show books that need attention
    if (emptyBooks > 0) {
      console.log('\n❌ Books with no chapters seeded:');
      for (const book of allBooks) {
        const seeded = countMap.get(book.id!) || 0;
        if (seeded === 0) {
          console.log(`   - ${book.name} (${book.amharicName})`);
        }
      }
    }

    if (partialBooks > 0) {
      console.log('\n⚠️  Books with partial chapters:');
      for (const book of allBooks) {
        const seeded = countMap.get(book.id!) || 0;
        if (seeded > 0 && seeded < book.chapters) {
          console.log(`   - ${book.name}: ${seeded}/${book.chapters} chapters`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSeededChapters().catch(console.error);
