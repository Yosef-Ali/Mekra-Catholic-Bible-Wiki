import { processPdfBook } from './pdf-extractor';

/**
 * Rate-limit aware extractor
 * Processes with delays to avoid quota issues
 */

async function slowExtract(
  pdfPath: string,
  bookName: string,
  amharicName: string,
  chapter: number
) {
  console.log('\n🐌 Slow Mode: Processing with rate limit protection\n');

  try {
    console.log('⏳ Waiting 60 seconds before starting (to clear quota)...');
    await new Promise(resolve => setTimeout(resolve, 60000));

    console.log('✅ Starting extraction now...\n');

    const result = await processPdfBook(
      pdfPath,
      bookName,
      amharicName,
      chapter,
      chapter
    );

    console.log('\n✅ Extraction complete!');
    return result;

  } catch (error: any) {
    if (error.status === 429) {
      console.log('\n⚠️  Rate limit hit again.');
      console.log('Please wait 2-3 minutes and try again.');
      console.log('\nTIP: Consider upgrading your Gemini API plan for bulk processing.');
    } else {
      console.error('\n❌ Error:', error.message);
    }
    throw error;
  }
}

const args = process.argv.slice(2);
if (args.length < 4) {
  console.log(`
Usage: pnpm tsx scripts/slow-extract.ts <pdf> <book> <amharic_name> <chapter>

This script waits 60 seconds before processing to clear rate limits.
  `);
  process.exit(1);
}

const [pdfPath, bookName, amharicName, chapterStr] = args;
slowExtract(pdfPath, bookName, amharicName, parseInt(chapterStr));
