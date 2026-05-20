import { config } from 'dotenv';
import { db } from '../services/db';
import { books } from '../services/schema';
import { spawn } from 'child_process';

config();

/**
 * Process all books in the database sequentially
 */
async function processAllBooks() {
  console.log('🚀 STARTING NON-STOP FORMATTING OF ALL BOOKS\n');
  console.log('=' .repeat(60));

  const allBooks = await db.select().from(books).orderBy(books.id);

  console.log(`\n📚 Found ${allBooks.length} books to process\n`);

  let totalProcessed = 0;
  let totalFailed = 0;

  for (const book of allBooks) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📖 ${book.amharicName} (${book.name})`);
    console.log(`   ID: ${book.id} | Chapters: ${book.chapters}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Run the formatter for this book
      await new Promise((resolve, reject) => {
        const process = spawn('npx', [
          'tsx',
          'scripts/gemini-format-analyzer.ts',
          book.id.toString(),
          '1',
          book.chapters.toString()
        ], {
          cwd: '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible',
          stdio: 'inherit'
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve(null);
          } else {
            reject(new Error(`Process exited with code ${code}`));
          }
        });

        process.on('error', reject);
      });

      totalProcessed++;
      console.log(`\n✅ Completed: ${book.amharicName}`);
    } catch (error) {
      totalFailed++;
      console.error(`\n❌ Failed: ${book.amharicName}`, error);
      // Continue with next book
    }

    // Small delay between books
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log(`\n\n${'='.repeat(60)}`);
  console.log('🎉 ALL BOOKS PROCESSING COMPLETE!');
  console.log(`${'='.repeat(60)}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total books: ${allBooks.length}`);
  console.log(`   ✅ Processed: ${totalProcessed}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log(`\n${'='.repeat(60)}\n`);
}

processAllBooks().catch(console.error);
