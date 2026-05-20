/**
 * Stage 2: Validate extracted JSON files locally (no API call).
 * Checks for verse gaps, duplicates, suspiciously short/empty text, and
 * chapters with fewer verses than expected.
 *
 * Usage: npx tsx scripts/bible-validate.ts
 * Output: extraction_output/validation_report.json
 * Requires: extraction_output/raw/*.json
 */

import fs from 'fs';
import path from 'path';

import { RAW_DIR, REPORT_PATH } from './bible-shared';

// Known verse counts per chapter for core books (spot-check reference)
// Add more as needed — only used for chapters explicitly listed here
const EXPECTED_VERSES: Record<string, Record<number, number>> = {
  Genesis:     { 1: 31, 2: 25, 3: 24, 4: 26, 5: 32, 50: 26 },
  Exodus:      { 1: 22, 20: 26, 40: 38 },
  Psalms:      { 1: 6, 23: 6, 119: 176, 150: 6 },
  Matthew:     { 1: 25, 5: 48, 28: 20 },
  Mark:        { 1: 45, 16: 20 },
  Luke:        { 1: 80, 24: 53 },
  John:        { 1: 51, 21: 25 },
  Revelation:  { 1: 20, 22: 21 },
};

interface Flag {
  book: string;
  chapter: number;
  severity: 'error' | 'warning';
  issue: string;
}

interface ValidationReport {
  generated_at: string;
  total_books: number;
  total_chapters: number;
  total_verses: number;
  flagged_chapters: Flag[];
  clean_books: string[];
  books_with_flags: string[];
}

function validateBook(filePath: string): { flags: Flag[]; chapterCount: number; verseCount: number } {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const bookName: string = raw.book_name;
  const chapters: any[] = raw.chapters || [];

  const flags: Flag[] = [];
  let totalVerses = 0;

  for (const ch of chapters) {
    const chNum: number = ch.chapter_number;
    const sections: any[] = ch.sections || [];

    // Collect all verses in this chapter (flattened)
    const verses: { verse_number: number; text: string }[] = [];
    for (const sec of sections) {
      for (const v of sec.verses || []) {
        verses.push({ verse_number: v.verse_number, text: v.text || '' });
      }
    }

    totalVerses += verses.length;

    if (verses.length === 0) {
      flags.push({ book: bookName, chapter: chNum, severity: 'error', issue: 'Chapter has 0 verses' });
      continue;
    }

    // Sort by verse number to check ordering
    const sorted = [...verses].sort((a, b) => a.verse_number - b.verse_number);

    // Check for duplicate verse numbers
    const seen = new Set<number>();
    for (const v of sorted) {
      if (seen.has(v.verse_number)) {
        flags.push({ book: bookName, chapter: chNum, severity: 'error', issue: `Duplicate verse ${v.verse_number}` });
      }
      seen.add(v.verse_number);
    }

    // Check for verse numbering gaps > 2
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].verse_number - sorted[i - 1].verse_number;
      if (gap > 2) {
        flags.push({
          book: bookName, chapter: chNum, severity: 'warning',
          issue: `Gap in verse numbering: ${sorted[i - 1].verse_number} → ${sorted[i].verse_number}`
        });
      }
    }

    // Check for empty or suspiciously short verse texts
    for (const v of verses) {
      const text = v.text.trim();
      if (text.length === 0) {
        flags.push({ book: bookName, chapter: chNum, severity: 'error', issue: `Verse ${v.verse_number} has empty text` });
      } else if (text.length < 8 && !text.startsWith('[')) {
        flags.push({ book: bookName, chapter: chNum, severity: 'warning', issue: `Verse ${v.verse_number} text suspiciously short: "${text}"` });
      }
    }

    // Check verse count against known expected values
    const knownCount = EXPECTED_VERSES[bookName]?.[chNum];
    if (knownCount !== undefined) {
      const diff = Math.abs(verses.length - knownCount);
      if (diff > 2) {
        flags.push({
          book: bookName, chapter: chNum, severity: 'error',
          issue: `Expected ~${knownCount} verses, got ${verses.length}`
        });
      }
    }

    // Flag any chapter with fewer than 3 verses as likely incomplete
    if (verses.length < 3) {
      flags.push({ book: bookName, chapter: chNum, severity: 'warning', issue: `Only ${verses.length} verses — possibly incomplete` });
    }
  }

  return { flags, chapterCount: chapters.length, verseCount: totalVerses };
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    console.error('❌ No raw extractions found. Run bible-extract.ts first.');
    process.exit(1);
  }

  const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.error('❌ No JSON files in extraction_output/raw/');
    process.exit(1);
  }

  console.log(`\n🔍 Validating ${files.length} extracted book(s)...\n`);
  console.log('='.repeat(70));
  console.log(`${'Book'.padEnd(22)} ${'Chapters'.padStart(9)} ${'Verses'.padStart(8)} ${'Flags'.padStart(7)}`);
  console.log('='.repeat(70));

  const allFlags: Flag[] = [];
  const cleanBooks: string[] = [];
  const flaggedBooks: string[] = [];
  let totalChapters = 0;
  let totalVerses = 0;

  for (const file of files) {
    const filePath = path.join(RAW_DIR, file);
    const bookName = file.replace('.json', '');

    try {
      const { flags, chapterCount, verseCount } = validateBook(filePath);
      totalChapters += chapterCount;
      totalVerses += verseCount;
      allFlags.push(...flags);

      const errorCount  = flags.filter(f => f.severity === 'error').length;
      const warnCount   = flags.filter(f => f.severity === 'warning').length;
      const flagSummary = flags.length === 0 ? '✅ clean' : `❌ ${errorCount}err ${warnCount}warn`;

      console.log(`${bookName.padEnd(22)} ${String(chapterCount).padStart(9)} ${String(verseCount).padStart(8)} ${flagSummary.padStart(7)}`);

      if (flags.length === 0) {
        cleanBooks.push(bookName);
      } else {
        flaggedBooks.push(bookName);
      }
    } catch (err: any) {
      console.log(`${bookName.padEnd(22)} ${'ERROR'.padStart(9)} — ${err.message}`);
      allFlags.push({ book: bookName, chapter: 0, severity: 'error', issue: `Could not parse file: ${err.message}` });
      flaggedBooks.push(bookName);
    }
  }

  console.log('='.repeat(70));
  console.log(`\nTotal: ${files.length} books | ${totalChapters} chapters | ${totalVerses} verses`);

  const errors   = allFlags.filter(f => f.severity === 'error').length;
  const warnings = allFlags.filter(f => f.severity === 'warning').length;
  console.log(`Flags: ${errors} errors, ${warnings} warnings across ${flaggedBooks.length} book(s)\n`);

  // Print per-flag details for flagged books
  if (allFlags.length > 0) {
    console.log('── Flagged chapters ──────────────────────────────────────');
    for (const flag of allFlags) {
      const icon = flag.severity === 'error' ? '❌' : '⚠️ ';
      console.log(`${icon} ${flag.book} ch.${flag.chapter}: ${flag.issue}`);
    }
    console.log('');
  }

  const report: ValidationReport = {
    generated_at: new Date().toISOString(),
    total_books: files.length,
    total_chapters: totalChapters,
    total_verses: totalVerses,
    flagged_chapters: allFlags,
    clean_books: cleanBooks,
    books_with_flags: flaggedBooks,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`💾 Report saved to: ${REPORT_PATH}`);

  if (flaggedBooks.length > 0) {
    console.log('\nNext step: npx tsx scripts/bible-review.ts   (re-extract flagged chapters)');
  } else {
    console.log('\nNext step: npx tsx scripts/bible-seed.ts   (all clean — seed to database)');
  }
}

main().catch(console.error);
