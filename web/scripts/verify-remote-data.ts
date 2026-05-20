import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, sql } from 'drizzle-orm';

async function verifyRemoteData() {
  console.log('🔍 Verifying Remote Database Data...\n');

  // Check database connection
  console.log('📡 Database URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
  console.log('');

  // Count books
  const bookCount = await db.select({ count: sql<number>`count(*)` })
    .from(books);
  console.log(`📚 Books table: ${bookCount[0].count} books`);

  // Count chapters
  const chapterCount = await db.select({ count: sql<number>`count(*)` })
    .from(chapterContents);
  console.log(`📄 Chapter_contents table: ${chapterCount[0].count} chapters`);

  // Sample data from chapter_contents
  console.log('\n📖 Sample Chapter Data:');
  const samples = await db.select()
    .from(chapterContents)
    .limit(5);

  for (const sample of samples) {
    const book = await db.select().from(books).where(eq(books.id, sample.bookId)).limit(1);
    console.log(`   ✅ ${book[0]?.name} Ch${sample.chapterNumber}: ${sample.content.substring(0, 80)}...`);
  }

  console.log('\n✅ Remote database is working correctly!');
  console.log('\n💡 To view in Drizzle Studio:');
  console.log('   pnpm db:studio');
  console.log('   Then open: https://local.drizzle.studio');
  console.log('   Look for the "chapter_contents" table!');
}

verifyRemoteData().catch(console.error);
