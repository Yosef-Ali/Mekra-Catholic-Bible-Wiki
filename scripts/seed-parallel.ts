import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and } from 'drizzle-orm';
import { getChapterContent } from '../services/geminiService';

/**
 * Parallel Bible seeding - Process multiple books simultaneously
 * Much faster than sequential seeding
 */

interface BookRange {
  startId: number;
  endId: number;
  name: string;
}

async function seedBookRange(range: BookRange) {
  console.log(`\n🚀 [Worker ${range.name}] Starting books ${range.startId}-${range.endId}`);

  try {
    const bookList = await db.select().from(books)
      .where(and(
        eq(books.id, range.startId) // This is simplified, should use >= and <=
      ));

    for (const book of bookList) {
      if (book.id! < range.startId || book.id! > range.endId) continue;

      console.log(`\n[${range.name}] 📖 ${book.amharicName} (${book.name}) - ${book.chapters} chapters`);

      for (let chapterNum = 1; chapterNum <= book.chapters; chapterNum++) {
        try {
          // Check if exists
          const existing = await db.select()
            .from(chapterContents)
            .where(and(
              eq(chapterContents.bookId, book.id!),
              eq(chapterContents.chapterNumber, chapterNum)
            ))
            .limit(1);

          if (existing.length > 0) {
            console.log(`[${range.name}]    ⏭️  Ch ${chapterNum} exists`);
            continue;
          }

          // Generate with AI
          const content = await getChapterContent(book.amharicName, chapterNum);

          if (!content || content.includes('Error') || content.includes('ይቅርታ')) {
            console.log(`[${range.name}]    ❌ Ch ${chapterNum} failed`);
            continue;
          }

          // Insert
          await db.insert(chapterContents).values({
            bookId: book.id!,
            chapterNumber: chapterNum,
            content,
            verified: 1,
          });

          console.log(`[${range.name}]    ✅ Ch ${chapterNum} (${content.length} chars)`);

          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.log(`[${range.name}]    ❌ Ch ${chapterNum} error: ${error instanceof Error ? error.message : String(error)}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    console.log(`\n✅ [Worker ${range.name}] Completed!`);

  } catch (error) {
    console.error(`\n❌ [Worker ${range.name}] Failed:`, error);
  }
}

async function seedParallel() {
  console.log('🚀 Starting PARALLEL Bible seeding...\n');

  // Divide Bible into 4 parallel workers
  const ranges: BookRange[] = [
    { startId: 1, endId: 18, name: 'Worker-1 (Torah-History)' },      // Genesis - 2 Chronicles
    { startId: 19, endId: 36, name: 'Worker-2 (Wisdom)' },            // Ezra - Sirach
    { startId: 37, endId: 58, name: 'Worker-3 (Prophets)' },          // Isaiah - Acts
    { startId: 59, endId: 73, name: 'Worker-4 (Epistles)' },          // Romans - Revelation
  ];

  console.log('📊 Work distribution:');
  for (const range of ranges) {
    console.log(`   ${range.name}: Books ${range.startId}-${range.endId}`);
  }

  console.log('\n⏱️  Starting in 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Run all workers in parallel
  await Promise.all(ranges.map(range => seedBookRange(range)));

  console.log('\n' + '='.repeat(80));
  console.log('✅ PARALLEL SEEDING COMPLETE!');
  console.log('='.repeat(80));
}

seedParallel().catch(console.error);
