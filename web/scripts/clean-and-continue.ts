import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getChapterContent } from '../services/geminiService';

/**
 * 1. Clean duplicate chapters
 * 2. Continue seeding from where we left off
 */

async function cleanDuplicates() {
  console.log('🧹 Cleaning duplicate chapters...\n');

  const allChapters = await db.select().from(chapterContents).orderBy(chapterContents.id);

  const seen = new Set<string>();
  const duplicates: number[] = [];

  for (const chapter of allChapters) {
    const key = `${chapter.bookId}-${chapter.chapterNumber}`;
    if (seen.has(key)) {
      duplicates.push(chapter.id);
    } else {
      seen.add(key);
    }
  }

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate chapters`);
    for (const id of duplicates) {
      await db.delete(chapterContents).where(eq(chapterContents.id, id));
    }
    console.log(`✅ Deleted ${duplicates.length} duplicates\n`);
  } else {
    console.log('✅ No duplicates found\n');
  }
}

async function continueSeed (startBookId: number = 7) {
  console.log(`📖 Continuing seeding from book ${startBookId}...\n`);

  const allBooks = await db.select().from(books).orderBy(books.id);
  let totalSeeded = 0;
  let totalFailed = 0;

  for (const book of allBooks) {
    if (book.id! < startBookId) continue;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📖 ${book.amharicName} (${book.name}) - ${book.chapters} chs`);
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
          console.log(`   [${ch}/${book.chapters}] ⏭️  exists`);
          continue;
        }

        // Generate
        console.log(`   [${ch}/${book.chapters}] 🤖 generating...`);
        const content = await getChapterContent(book.amharicName, ch);

        if (!content || content.includes('Error') || content.includes('ይቅርታ')) {
          console.log(`   [${ch}/${book.chapters}] ❌ failed`);
          totalFailed++;
          continue;
        }

        // Save
        await db.insert(chapterContents).values({
          bookId: book.id!,
          chapterNumber: ch,
          content,
          verified: 1,
        });

        totalSeeded++;
        console.log(`   [${ch}/${book.chapters}] ✅ saved (${content.length} chars)`);

        // Rate limit: 1 second between chapters
        await new Promise(r => setTimeout(r, 1000));

      } catch (error) {
        console.log(`   [${ch}/${book.chapters}] ❌ error: ${error instanceof Error ? error.message.substring(0, 50) : String(error)}`);
        totalFailed++;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // Pause between books
    console.log('\n⏸️  Pausing 3 seconds...');
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Seeded: ${totalSeeded} chapters`);
  console.log(`❌ Failed: ${totalFailed} chapters`);
  console.log('='.repeat(60));
}

async function main() {
  console.log('🚀 Clean & Continue Seeding\n');

  await cleanDuplicates();
  await continueSeed(7); // Start from Judges

  console.log('\n✅ Complete!');
}

main().catch(console.error);
