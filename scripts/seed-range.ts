import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getChapterContent } from '../services/geminiService';

/**
 * Seed a specific range of books (for parallel processing)
 * Usage: pnpm tsx scripts/seed-range.ts <startBookId> <endBookId>
 */

async function seedRange(startBookId: number, endBookId: number) {
  console.log(`🚀 Seeding Books ${startBookId}-${endBookId}\n`);

  const bookList = await db.select()
    .from(books)
    .where(and(
      gte(books.id, startBookId),
      lte(books.id, endBookId)
    ))
    .orderBy(books.id);

  console.log(`📚 Found ${bookList.length} books in range\n`);

  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of bookList) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📖 ${book.amharicName} (${book.name})`);
    console.log('='.repeat(60));

    for (let ch = 1; ch <= book.chapters; ch++) {
      try {
        // Check exists
        const exists = await db.select()
          .from(chapterContents)
          .where(and(
            eq(chapterContents.bookId, book.id!),
            eq(chapterContents.chapterNumber, ch)
          ))
          .limit(1);

        if (exists.length > 0) {
          console.log(`   [${ch}/${book.chapters}] ⏭️`);
          skipped++;
          continue;
        }

        // Generate
        console.log(`   [${ch}/${book.chapters}] 🤖 ...`);
        const content = await getChapterContent(book.amharicName, ch);

        if (!content || content.includes('Error')) {
          console.log(`   [${ch}/${book.chapters}] ❌`);
          failed++;
          continue;
        }

        // Save
        await db.insert(chapterContents).values({
          bookId: book.id!,
          chapterNumber: ch,
          content,
          verified: 1,
        });

        seeded++;
        console.log(`   [${ch}/${book.chapters}] ✅`);

        await new Promise(r => setTimeout(r, 800));

      } catch (error) {
        console.log(`   [${ch}/${book.chapters}] ❌ ${error instanceof Error ? error.message.substring(0, 30) : ''}`);
        failed++;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Seeded: ${seeded} | ⏭️  Skipped: ${skipped} | ❌ Failed: ${failed}`);
  console.log('='.repeat(60));
}

const [startStr, endStr] = process.argv.slice(2);
const start = parseInt(startStr);
const end = parseInt(endStr);

if (!start || !end) {
  console.log('Usage: pnpm tsx scripts/seed-range.ts <startBookId> <endBookId>');
  console.log('Example: pnpm tsx scripts/seed-range.ts 1 36');
  process.exit(1);
}

seedRange(start, end).catch(console.error);
