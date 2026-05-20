import { db } from '../services/db';
import { chapterContents } from '../services/schema';
import { sql } from 'drizzle-orm';

async function cleanAllDuplicates() {
  console.log('🧹 CLEANING ALL DUPLICATES FROM REMOTE DATABASE\n');
  console.log(`📡 Database: ${process.env.DATABASE_URL?.substring(0, 60)}...\n`);

  // Get all chapters
  const all = await db.select().from(chapterContents).orderBy(chapterContents.id);
  console.log(`Total chapters before cleanup: ${all.length}\n`);

  // Track unique chapters
  const seen = new Map<string, number>();
  const toDelete: number[] = [];

  for (const chapter of all) {
    const key = `${chapter.bookId}-${chapter.chapterNumber}`;

    if (seen.has(key)) {
      // This is a duplicate - mark for deletion
      toDelete.push(chapter.id);
    } else {
      // First occurrence - keep this one
      seen.set(key, chapter.id);
    }
  }

  console.log(`Found ${toDelete.length} duplicates to delete\n`);

  if (toDelete.length > 0) {
    console.log('Deleting duplicates...');

    // Delete in batches using IN clause
    const batchSize = 100;
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      await db.delete(chapterContents)
        .where(sql`id IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`);
      console.log(`  Deleted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(toDelete.length/batchSize)} (${batch.length} chapters)`);
    }

    console.log(`\n✅ Deleted ${toDelete.length} duplicate chapters`);
  }

  // Verify
  const remaining = await db.select({ count: sql<number>`count(*)` })
    .from(chapterContents);

  console.log(`\n📊 Chapters after cleanup: ${remaining[0].count}`);
  console.log(`✅ Cleanup complete!`);
}

cleanAllDuplicates().catch(console.error);
