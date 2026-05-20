import { config } from 'dotenv';
import { db } from '../services/db';
import { books } from '../services/schema';
import { spawn } from 'child_process';
import { eq } from 'drizzle-orm';

config();

interface FailedChapter {
  bookId: number;
  bookName: string;
  amharicName: string;
  chapterNumber: number;
}

// Failed chapters from previous runs
const FAILED_CHAPTERS: FailedChapter[] = [
  // Exodus failures
  { bookId: 148, bookName: 'Exodus', amharicName: 'ዘጸአት', chapterNumber: 1 },
  { bookId: 148, bookName: 'Exodus', amharicName: 'ዘጸአት', chapterNumber: 28 },
  { bookId: 148, bookName: 'Exodus', amharicName: 'ዘጸአት', chapterNumber: 31 },
  { bookId: 148, bookName: 'Exodus', amharicName: 'ዘጸአት', chapterNumber: 35 },

  // Genesis failures
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 11 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 14 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 20 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 21 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 22 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 24 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 25 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 26 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 27 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 29 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 30 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 31 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 32 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 33 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 34 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረת', chapterNumber: 35 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 36 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 37 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 38 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 39 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 40 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 41 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 42 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 43 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 44 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 45 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 46 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 47 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 48 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 49 },
  { bookId: 147, bookName: 'Genesis', amharicName: 'ዘፍጥረት', chapterNumber: 50 },
];

/**
 * Exponential backoff retry logic
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 5000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`   ⏳ Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Process a single chapter with retry logic
 */
async function processChapterWithRetry(chapter: FailedChapter): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📖 ${chapter.amharicName} (${chapter.bookName}) - Chapter ${chapter.chapterNumber}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    await retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        const process = spawn('npx', [
          'tsx',
          'scripts/gemini-format-analyzer.ts',
          chapter.bookId.toString(),
          chapter.chapterNumber.toString(),
          chapter.chapterNumber.toString()
        ], {
          cwd: '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible',
          stdio: 'inherit',
          timeout: 120000 // 2 minute timeout per chapter
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
    }, 3, 5000); // 3 retries, 5 second base delay

    console.log(`\n✅ Success: ${chapter.bookName} ${chapter.chapterNumber}`);
    return true;

  } catch (error) {
    console.error(`\n❌ Failed after retries: ${chapter.bookName} ${chapter.chapterNumber}`);
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Main retry process - sequential processing with delays
 */
async function retryFailedChapters() {
  console.log('🔄 RETRYING FAILED CHAPTERS WITH IMPROVED ERROR HANDLING\n');
  console.log('=' .repeat(60));
  console.log(`\n📊 Total chapters to retry: ${FAILED_CHAPTERS.length}\n`);
  console.log('⚡ Processing sequentially with 5-second delays between chapters');
  console.log('🔁 Each chapter gets 3 retry attempts with exponential backoff\n');
  console.log('=' .repeat(60));

  let successCount = 0;
  let failureCount = 0;
  const stillFailed: FailedChapter[] = [];

  for (let i = 0; i < FAILED_CHAPTERS.length; i++) {
    const chapter = FAILED_CHAPTERS[i];

    console.log(`\n[${i + 1}/${FAILED_CHAPTERS.length}]`);

    const success = await processChapterWithRetry(chapter);

    if (success) {
      successCount++;
    } else {
      failureCount++;
      stillFailed.push(chapter);
    }

    // Longer delay between chapters to avoid rate limiting (5 seconds)
    if (i < FAILED_CHAPTERS.length - 1) {
      console.log('\n⏸️  Waiting 5 seconds before next chapter...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`\n\n${'='.repeat(60)}`);
  console.log('🎉 RETRY PROCESS COMPLETE!');
  console.log(`${'='.repeat(60)}`);
  console.log(`\n📊 Results:`);
  console.log(`   Total attempted: ${FAILED_CHAPTERS.length}`);
  console.log(`   ✅ Successful: ${successCount} (${Math.round(successCount / FAILED_CHAPTERS.length * 100)}%)`);
  console.log(`   ❌ Still failed: ${failureCount} (${Math.round(failureCount / FAILED_CHAPTERS.length * 100)}%)`);

  if (stillFailed.length > 0) {
    console.log(`\n\n❌ Chapters that still failed:`);
    stillFailed.forEach(ch => {
      console.log(`   - ${ch.bookName} ${ch.chapterNumber}`);
    });
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

retryFailedChapters().catch(console.error);
