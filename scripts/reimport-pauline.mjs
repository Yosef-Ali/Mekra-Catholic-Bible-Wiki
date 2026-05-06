#!/usr/bin/env node
/**
 * reimport-pauline.mjs
 *
 * Re-imports Romans and 1 Corinthians from clean vision_page_*.json files
 * into formatted_chapter_contents with CORRECT book_id assignments.
 *
 * Problem: The original seed used amharic_bible_extracted.txt which had
 * misaligned book boundaries. The vision_page JSONs from Gemini have the
 * correct book name per chapter.
 *
 * This script reads all vision_page JSONs, finds ones containing Romans or
 * 1 Corinthians chapters, and re-imports them with the right book_id.
 *
 * Usage: node scripts/reimport-pauline.mjs [--dry-run]
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const APP_ENV = '/Users/mekdesyared/Mekra-Catholic-Bible/.env';
if (!process.env.DATABASE_URL && existsSync(APP_ENV)) {
  for (const line of readFileSync(APP_ENV, 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, '');
  }
}
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found');
  process.exit(2);
}

const sql = neon(process.env.DATABASE_URL);
const dryRun = process.argv.includes('--dry-run');

const EXTRACT_DIR = '/Users/mekdesyared/Mekra-Catholic-Bible/extraction_output';

// Amharic book name → English book name (for DB lookup)
const TARGET_BOOKS = {
  'ወደ ሮሜ ሰዎች': 'Romans',
  '1ኛ ወደ ቆሮንቶስ ሰዎች': '1 Corinthians',
  '1ኛ ወደ ቆሮንቶስ': '1 Corinthians',
};

async function main() {
  console.log(dryRun ? '🔍 DRY RUN\n' : '⚠️  LIVE RUN\n');

  // Get book IDs from DB
  const dbBooks = await sql`SELECT id, name, amharic_name FROM books WHERE name = ANY(${Object.values(TARGET_BOOKS)})`;
  const bookMap = {};
  for (const b of dbBooks) {
    bookMap[b.name] = { id: b.id, amharic: b.amharic_name };
  }
  console.log('Book mappings:', JSON.stringify(bookMap, null, 2));

  // Collect all verses from vision_page JSONs
  const collected = {}; // { 'Romans': { 1: [{verse_number, text}, ...], ... }, ... }

  const allFiles = readdirSync(EXTRACT_DIR).filter(f => f.startsWith('vision_page_') && f.endsWith('.json'));
  console.log(`\nScanning ${allFiles.length} vision_page files...`);

  for (const file of allFiles) {
    const raw = readFileSync(join(EXTRACT_DIR, file), 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch { continue; }

    for (const chapter of data.chapters || []) {
      const amharicBook = chapter.book;
      const englishBook = TARGET_BOOKS[amharicBook];
      if (!englishBook) continue;

      const chNum = chapter.chapter;
      if (!collected[englishBook]) collected[englishBook] = {};
      if (!collected[englishBook][chNum]) collected[englishBook][chNum] = [];

      // Merge verses from this page into the chapter
      for (const verse of chapter.verses || []) {
        // Avoid duplicates by verse_number
        const exists = collected[englishBook][chNum].some(v => v.verse_number === verse.verse_number);
        if (!exists) {
          collected[englishBook][chNum].push(verse);
        }
      }
    }
  }

  // Report what we found
  for (const [book, chapters] of Object.entries(collected)) {
    const chNums = Object.keys(chapters).map(Number).sort((a,b) => a-b);
    console.log(`\n${book}: chapters [${chNums.join(', ')}]`);
    for (const ch of chNums) {
      console.log(`  Ch ${ch}: ${chapters[ch].length} verses`);
    }
  }

  // Import into DB
  console.log('\n=== Importing ===');
  let imported = 0, skipped = 0;

  for (const [bookName, chapters] of Object.entries(collected)) {
    const bookInfo = bookMap[bookName];
    if (!bookInfo) {
      console.log(`❌ Book "${bookName}" not found in DB`);
      continue;
    }

    for (const [chNum, verses] of Object.entries(chapters)) {
      // Sort verses by verse_number
      verses.sort((a, b) => a.verse_number - b.verse_number);

      // Build content JSON in the format expected by get_verse.mjs
      const content = JSON.stringify({
        sections: [{
          type: 'prose',
          verses: verses.map(v => ({
            verse_number: v.verse_number,
            text: v.text.trim(),
            indent: 0,
            is_new_paragraph: v.verse_number === 1
          }))
        }]
      });

      if (!dryRun) {
        // Delete existing row then insert
        await sql`DELETE FROM formatted_chapter_contents WHERE book_id = ${bookInfo.id} AND chapter_number = ${chNum}`;
        await sql`
          INSERT INTO formatted_chapter_contents (book_id, chapter_number, content)
          VALUES (${bookInfo.id}, ${chNum}, ${content}::jsonb)
        `;
      }
      console.log(`  ${bookName} ${chNum} (${verses.length}v) ${dryRun ? '[DRY RUN]' : '✅'}`);
      imported++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Imported: ${imported} chapters`);
  console.log(`Skipped: ${skipped} chapters`);
  if (dryRun) console.log('\n⚠️  DRY RUN — re-run without --dry-run to apply');
  else console.log('\n🎉 Re-import complete. Run: node scripts/validate_db_mappings.mjs');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
