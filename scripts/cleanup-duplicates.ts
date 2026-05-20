import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, gt } from 'drizzle-orm';

/**
 * Clean up duplicate book entries
 * Keeps the first 73 books (IDs 1-73) and removes duplicates
 */
async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate book entries...\n');

  try {
    // First, get all books to see what we have
    const allBooks = await db.select().from(books).orderBy(books.id);
    console.log(`Found ${allBooks.length} book entries total`);

    if (allBooks.length <= 73) {
      console.log('✅ No duplicates found, database is clean!');
      return;
    }

    // Find duplicates (books with ID > 73)
    const duplicates = allBooks.filter(b => b.id! > 73);
    console.log(`Found ${duplicates.length} duplicate book entries (IDs ${duplicates[0]?.id} - ${duplicates[duplicates.length - 1]?.id})`);

    // Check if any chapters are linked to duplicate books
    const chaptersInDuplicates = await db
      .select()
      .from(chapterContents)
      .where(gt(chapterContents.bookId, 73));

    console.log(`\nFound ${chaptersInDuplicates.length} chapters linked to duplicate books`);

    if (chaptersInDuplicates.length > 0) {
      console.log('\n📋 Migrating chapters from duplicates to original books...');

      for (const chapter of chaptersInDuplicates) {
        const originalBookId = chapter.bookId - 73; // Map 74->1, 75->2, etc.

        // Check if chapter already exists in original book
        const existing = await db
          .select()
          .from(chapterContents)
          .where(eq(chapterContents.bookId, originalBookId))
          .where(eq(chapterContents.chapterNumber, chapter.chapterNumber))
          .limit(1);

        if (existing.length === 0) {
          // Move chapter to original book
          await db
            .insert(chapterContents)
            .values({
              bookId: originalBookId,
              chapterNumber: chapter.chapterNumber,
              content: chapter.content,
              verified: chapter.verified,
            });
          console.log(`   ✅ Migrated chapter ${chapter.chapterNumber} from book ${chapter.bookId} to ${originalBookId}`);
        } else {
          console.log(`   ⏭️  Chapter ${chapter.chapterNumber} already exists in book ${originalBookId}, skipping`);
        }
      }

      // Delete chapters from duplicate books
      console.log('\n🗑️  Deleting chapters from duplicate books...');
      await db.delete(chapterContents).where(gt(chapterContents.bookId, 73));
      console.log('   ✅ Deleted');
    }

    // Delete duplicate books
    console.log('\n🗑️  Deleting duplicate book entries...');
    await db.delete(books).where(gt(books.id, 73));
    console.log('   ✅ Deleted');

    // Verify cleanup
    const remainingBooks = await db.select().from(books).orderBy(books.id);
    const remainingChapters = await db.select().from(chapterContents);

    console.log('\n' + '='.repeat(80));
    console.log('✅ CLEANUP COMPLETE');
    console.log('='.repeat(80));
    console.log(`Books remaining: ${remainingBooks.length}`);
    console.log(`Chapters remaining: ${remainingChapters.length}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

cleanupDuplicates().catch(console.error);
