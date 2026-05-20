import fs from 'fs';
import path from 'path';
import { processPdfBook } from './pdf-extractor';

/**
 * Batch process multiple PDF files
 *
 * This script processes an entire folder of PDF books
 */

interface BookConfig {
  filename: string;
  bookName: string;
  amharicName: string;
  chapters: number;
}

/**
 * Process all PDFs in a directory
 */
async function batchProcessPdfs(
  inputDir: string,
  booksConfig: BookConfig[]
): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('📚 BATCH PDF PROCESSING');
  console.log('='.repeat(80));
  console.log(`Input Directory: ${inputDir}`);
  console.log(`Books to Process: ${booksConfig.length}`);
  console.log('='.repeat(80) + '\n');

  const results: Array<{ book: string; status: 'success' | 'failed'; error?: string }> = [];

  for (let i = 0; i < booksConfig.length; i++) {
    const config = booksConfig[i];
    const pdfPath = path.join(inputDir, config.filename);

    console.log(`\n[${i + 1}/${booksConfig.length}] Processing: ${config.bookName}`);
    console.log('-'.repeat(80));

    try {
      // Check if file exists
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file not found: ${pdfPath}`);
      }

      // Process each chapter
      for (let chapter = 1; chapter <= config.chapters; chapter++) {
        console.log(`  📖 Chapter ${chapter}/${config.chapters}`);

        await processPdfBook(
          pdfPath,
          config.bookName,
          config.amharicName,
          chapter,
          chapter
        );

        // Add delay to avoid rate limiting
        if (chapter < config.chapters) {
          console.log('  ⏳ Waiting 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      results.push({
        book: config.bookName,
        status: 'success'
      });

      console.log(`  ✅ ${config.bookName} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        book: config.bookName,
        status: 'failed',
        error: errorMessage
      });
      console.error(`  ❌ ${config.bookName} failed:`, errorMessage);
    }

    // Delay between books
    if (i < booksConfig.length - 1) {
      console.log('\n⏳ Waiting 5 seconds before next book...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 BATCH PROCESSING SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log(`Total Books: ${results.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed Books:');
    results
      .filter(r => r.status === 'failed')
      .forEach(r => console.log(`  - ${r.book}: ${r.error}`));
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * Example configuration for Catholic Bible books
 */
const SAMPLE_CONFIG: BookConfig[] = [
  {
    filename: 'genesis.pdf',
    bookName: 'Genesis',
    amharicName: 'ኦሪት ዘፍጥረት',
    chapters: 50
  },
  {
    filename: 'exodus.pdf',
    bookName: 'Exodus',
    amharicName: 'ኦሪት ዘጸአት',
    chapters: 40
  },
  {
    filename: 'matthew.pdf',
    bookName: 'Matthew',
    amharicName: 'የማቴዎስ ወንጌል',
    chapters: 28
  },
  // Add more books as needed
];

/**
 * Load book configuration from JSON file
 */
function loadBooksConfig(configPath: string): BookConfig[] {
  if (!fs.existsSync(configPath)) {
    console.log(`⚠️  Config file not found: ${configPath}`);
    console.log('Creating sample config...');

    fs.writeFileSync(
      configPath,
      JSON.stringify(SAMPLE_CONFIG, null, 2),
      'utf-8'
    );

    console.log(`✅ Sample config created at: ${configPath}`);
    console.log('Please edit this file with your PDF filenames and book details.\n');
    return [];
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return config as BookConfig[];
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(`
📚 Batch PDF Processor for Catholic Bible

USAGE:
  pnpm tsx scripts/batch-process-pdfs.ts <input_directory> [config_file]

EXAMPLES:
  pnpm tsx scripts/batch-process-pdfs.ts ./books
  pnpm tsx scripts/batch-process-pdfs.ts ./books ./books-config.json

ARGUMENTS:
  input_directory - Directory containing PDF files
  config_file     - JSON file with book configurations (default: ./books-config.json)

CONFIG FILE FORMAT:
  [
    {
      "filename": "genesis.pdf",
      "bookName": "Genesis",
      "amharicName": "ኦሪት ዘፍጥረት",
      "chapters": 50
    },
    ...
  ]
    `);
    process.exit(1);
  }

  const [inputDir, configFile = './books-config.json'] = args;

  try {
    // Load configuration
    const booksConfig = loadBooksConfig(configFile);

    if (booksConfig.length === 0) {
      console.log('No books configured. Please edit the config file and try again.');
      process.exit(0);
    }

    // Verify input directory exists
    if (!fs.existsSync(inputDir)) {
      throw new Error(`Input directory not found: ${inputDir}`);
    }

    // Start batch processing
    await batchProcessPdfs(inputDir, booksConfig);

  } catch (error) {
    console.error('\n❌ Batch processing failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { batchProcessPdfs, loadBooksConfig };
