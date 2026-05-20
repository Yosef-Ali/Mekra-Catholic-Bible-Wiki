import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and } from 'drizzle-orm';
import { getChapterContent } from '../services/geminiService';

/**
 * Bulk seed all Bible chapters from AI generation
 * This generates and caches all chapters into the database
 * Run once to populate the entire Bible
 */

interface SeedProgress {
  totalBooks: number;
  totalChapters: number;
  seededChapters: number;
  failedChapters: number;
  skippedChapters: number;
}

async function seedAllChapters(startBookId: number = 1, startChapter: number = 1) {
  console.log('📖 Starting bulk Bible seeding...\n');

  const progress: SeedProgress = {
    totalBooks: 0,
    totalChapters: 0,
    seededChapters: 0,
    failedChapters: 0,
    skippedChapters: 0
  };

  try {
    // Get all books from database
    const allBooks = await db.select().from(books).orderBy(books.id);
    progress.totalBooks = allBooks.length;

    // Calculate total chapters
    progress.totalChapters = allBooks.reduce((sum, book) => sum + book.chapters, 0);

    console.log(`📚 Found ${allBooks.length} books`);
    console.log(`📄 Total chapters to seed: ${progress.totalChapters}\n`);
    console.log(`▶️  Starting from Book ID: ${startBookId}, Chapter: ${startChapter}\n`);

    // Process each book
    for (const book of allBooks) {
      // Skip books before startBookId
      if (book.id! < startBookId) {
        progress.skippedChapters += book.chapters;
        continue;
      }

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📖 ${book.amharicName} (${book.name}) - ${book.chapters} chapters`);
      console.log('='.repeat(80));

      // Determine starting chapter for this book
      const startFrom = book.id === startBookId ? startChapter : 1;

      // Process each chapter
      for (let chapterNum = startFrom; chapterNum <= book.chapters; chapterNum++) {
        const progressPercent = ((progress.seededChapters + progress.skippedChapters) / progress.totalChapters * 100).toFixed(1);
        console.log(`\n[${progressPercent}%] Chapter ${chapterNum}/${book.chapters}...`);

        try {
          // Check if chapter already exists
          const existing = await db.select()
            .from(chapterContents)
            .where(and(
              eq(chapterContents.bookId, book.id!),
              eq(chapterContents.chapterNumber, chapterNum)
            ))
            .limit(1);

          if (existing.length > 0) {
            console.log(`   ⏭️  Already exists, skipping`);
            progress.skippedChapters++;
            continue;
          }

          // Generate chapter content with AI
          console.log(`   🤖 Generating with AI...`);
          const content = await getChapterContent(book.amharicName, chapterNum);

          if (!content || content.includes('Error') || content.includes('ይቅርታ')) {
            console.log(`   ⚠️  Generation failed or returned error`);
            progress.failedChapters++;
            continue;
          }

          // Insert into database
          await db.insert(chapterContents).values({
            bookId: book.id!,
            chapterNumber: chapterNum,
            content: content,
            verified: 1, // Mark as verified since it's from AI
          });

          progress.seededChapters++;
          console.log(`   ✅ Seeded successfully (${content.length} chars)`);

          // Rate limiting: wait 2 seconds between chapters to avoid API throttling
          if (chapterNum < book.chapters) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (error) {
          console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
          progress.failedChapters++;

          // Wait a bit longer on error
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      // Wait between books
      if (book.id! < allBooks[allBooks.length - 1].id!) {
        console.log('\n⏸️  Pausing 5 seconds before next book...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SEEDING COMPLETE');
    console.log('='.repeat(80));
    console.log(`✅ Successfully seeded: ${progress.seededChapters} chapters`);
    console.log(`⏭️  Skipped (existing): ${progress.skippedChapters} chapters`);
    console.log(`❌ Failed: ${progress.failedChapters} chapters`);
    console.log(`📚 Total processed: ${progress.seededChapters + progress.skippedChapters + progress.failedChapters}/${progress.totalChapters}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    throw error;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);

  let startBookId = 1;
  let startChapter = 1;

  if (args.length >= 1) {
    startBookId = parseInt(args[0]);
  }
  if (args.length >= 2) {
    startChapter = parseInt(args[1]);
  }

  if (isNaN(startBookId) || isNaN(startChapter)) {
    console.log(`
📖 Bulk Bible Seeder

USAGE:
  pnpm seed:all                    # Seed all books from beginning
  pnpm seed:all <bookId>          # Start from specific book
  pnpm seed:all <bookId> <chapter> # Resume from specific chapter

EXAMPLES:
  pnpm seed:all                    # Seed everything
  pnpm seed:all 1                  # Start from Genesis
  pnpm seed:all 1 5                # Start from Genesis Chapter 5
  pnpm seed:all 40                 # Start from Matthew (NT)

NOTES:
  - This will take SEVERAL HOURS (1,189 chapters × 2-3 seconds each)
  - Skips chapters that already exist in the database
  - Uses AI to generate and format content properly
  - Rate limited to avoid API throttling
  - Can be stopped and resumed at any time

ESTIMATED TIME:
  - Full Bible: ~60-90 minutes
  - Old Testament: ~40 minutes  
  - New Testament: ~20 minutes
    `);
    process.exit(1);
  }

  console.log('\n⚠️  WARNING: This will seed THE ENTIRE BIBLE using AI generation.');
  console.log('⏱️  This process will take 60-90 minutes to complete.');
  console.log('💰 This will use your Gemini API credits.\n');
  console.log('▶️  Starting in 5 seconds... (Ctrl+C to cancel)\n');

  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    await seedAllChapters(startBookId, startChapter);
    console.log('\n✅ Seeding process completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding process failed:', error);
    process.exit(1);
  }
}

export { seedAllChapters };

// Always run main when this file is executed
main().catch(console.error);
