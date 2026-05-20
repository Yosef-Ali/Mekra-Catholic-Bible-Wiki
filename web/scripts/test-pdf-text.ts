/**
 * Test: Extract text with font/layout metadata from the Bible PDF
 * Run: npx tsx scripts/test-pdf-text.ts
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
import fs from 'fs';

async function main() {
  const PDF_PATH = 'The Amharic Bible Catholic Edition - Emmaus.pdf';
  console.log('Reading PDF...');

  const buffer = fs.readFileSync(PDF_PATH);
  const parser = new PDFParse();

  // Parse first 20 pages
  const result = await parser.parse(buffer, { max: 20 });

  console.log(`Total pages: ${result.numpages}`);
  console.log(`Text length: ${result.text.length}\n`);

  // Show pages 9-12 area (Genesis)
  const pages = result.text.split(/\f/); // form feed = page separator
  console.log(`Split into ${pages.length} page segments\n`);

  for (let i = 8; i < Math.min(12, pages.length); i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`PAGE ${i + 1}`);
    console.log(`${'='.repeat(60)}`);
    console.log(pages[i].substring(0, 1500));
  }
}

main().catch(console.error);
