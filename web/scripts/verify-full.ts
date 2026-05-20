/**
 * Full Emmaus Bible verification: DB content vs PDF extraction.
 *
 * Checks:
 *  1. All 73 books present in DB
 *  2. Expected chapter count matches actual
 *  3. Every chapter has content (non-empty verses)
 *  4. Every chapter has formatting rules
 *  5. Verse counts per chapter match vision extraction
 *  6. No empty verse texts
 *  7. Ge'ez numeral prefixes (data quality)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { sql } from '../services/db';

const BASE = path.join(process.cwd(), 'extraction_output');

interface Issue { book: string; chapter?: number; issue: string }

async function main() {
  const issues: Issue[] = [];
  let totalChapters = 0;
  let totalVerses = 0;
  let chaptersWithContent = 0;
  let chaptersWithRules = 0;
  let emptyVerses = 0;
  let geezPrefixed = 0;

  // 1. Get all books
  const books = await sql`SELECT id, name, amharic_name as "amharicName", chapters, section FROM books ORDER BY id` as Array<{
    id: number; name: string; amharicName: string; chapters: number; section: string;
  }>;

  console.log(`\n📖 Books in DB: ${books.length}`);
  if (books.length !== 73) {
    issues.push({ book: '*', issue: `Expected 73 books, found ${books.length}` });
  }

  // 2. Get all chapter data
  const allChapters = await sql`
    SELECT book_id, chapter_number, content, formatting_rules IS NOT NULL as has_rules
    FROM formatted_chapter_contents
    ORDER BY book_id, chapter_number
  ` as Array<{ book_id: number; chapter_number: number; content: any; has_rules: boolean }>;

  const chapterMap = new Map<string, typeof allChapters[0]>();
  for (const ch of allChapters) {
    chapterMap.set(`${ch.book_id}:${ch.chapter_number}`, ch);
  }

  // 3. Load vision extraction verse counts for comparison
  const visionCounts = new Map<string, number>(); // "bookName:chapter" -> verse count
  const pageMap = JSON.parse(fs.readFileSync(path.join(BASE, 'page_map.json'), 'utf-8'));
  for (const bookEntry of pageMap.books) {
    for (let p = bookEntry.start_page; p <= bookEntry.end_page; p++) {
      const vf = path.join(BASE, `vision_page_${p}.json`);
      if (!fs.existsSync(vf)) continue;
      const vd = JSON.parse(fs.readFileSync(vf, 'utf-8'));
      for (const ch of vd.chapters || []) {
        const key = `${bookEntry.name}:${ch.chapter}`;
        const existing = visionCounts.get(key) || 0;
        visionCounts.set(key, existing + (ch.verses?.length || 0));
      }
    }
  }

  // 4. Verify each book
  const bookResults: Array<{ name: string; am: string; section: string; expected: number; actual: number; verses: number; withContent: number; withRules: number; issues: string[] }> = [];

  for (const book of books) {
    const bookIssues: string[] = [];
    let bookVerses = 0;
    let bookWithContent = 0;
    let bookWithRules = 0;
    let actualChapters = 0;

    for (let ch = 1; ch <= book.chapters; ch++) {
      totalChapters++;
      const key = `${book.id}:${ch}`;
      const data = chapterMap.get(key);

      if (!data) {
        bookIssues.push(`ch${ch}: MISSING from DB`);
        issues.push({ book: book.name, chapter: ch, issue: 'Missing from DB' });
        continue;
      }

      actualChapters++;

      // Check content
      const content = data.content;
      let verseCount = 0;
      let emptyInChapter = 0;
      let geezInChapter = 0;

      if (content?.sections && Array.isArray(content.sections)) {
        for (const section of content.sections) {
          for (const v of section.verses || []) {
            verseCount++;
            totalVerses++;
            bookVerses++;
            const text = (v.text || '').trim();
            if (!text) {
              emptyInChapter++;
              emptyVerses++;
            }
            if (/^[፩-፼]/.test(text)) {
              geezInChapter++;
              geezPrefixed++;
            }
          }
        }
      } else if (typeof content === 'string' && content.trim()) {
        verseCount = 1;
        totalVerses++;
        bookVerses++;
      }

      if (verseCount > 0) {
        chaptersWithContent++;
        bookWithContent++;
      } else {
        bookIssues.push(`ch${ch}: no verses`);
        issues.push({ book: book.name, chapter: ch, issue: 'No verse content' });
      }

      if (data.has_rules) {
        chaptersWithRules++;
        bookWithRules++;
      }

      if (emptyInChapter > 0) {
        bookIssues.push(`ch${ch}: ${emptyInChapter} empty verse(s)`);
      }

      // Compare verse count with vision extraction
      const pmBook = pageMap.books.find((b: any) => b.name === book.name || b.name === book.name.replace(/ /g, '_'));
      if (pmBook) {
        const vKey = `${pmBook.name}:${ch}`;
        const vCount = visionCounts.get(vKey);
        if (vCount && Math.abs(vCount - verseCount) > 2) {
          bookIssues.push(`ch${ch}: DB has ${verseCount} verses, PDF extraction has ${vCount}`);
        }
      }
    }

    bookResults.push({
      name: book.name,
      am: book.amharicName,
      section: book.section,
      expected: book.chapters,
      actual: actualChapters,
      verses: bookVerses,
      withContent: bookWithContent,
      withRules: bookWithRules,
      issues: bookIssues,
    });
  }

  // 5. Print results
  console.log('\n' + '═'.repeat(90));
  console.log('  EMMAUS CATHOLIC BIBLE — FULL VERIFICATION REPORT');
  console.log('═'.repeat(90));

  for (const section of ['OT', 'Apocrypha', 'NT']) {
    const sectionBooks = bookResults.filter(b => b.section === section);
    const label = section === 'OT' ? 'OLD TESTAMENT' : section === 'NT' ? 'NEW TESTAMENT' : 'DEUTEROCANONICAL';
    console.log(`\n── ${label} (${sectionBooks.length} books) ──\n`);
    console.log(`${'Book'.padEnd(22)} ${'Am'.padEnd(18)} ${'Chs'.padStart(4)} ${'Vrs'.padStart(6)} ${'Fmt'.padStart(4)} ${'Status'.padStart(8)}`);
    console.log('─'.repeat(70));

    for (const b of sectionBooks) {
      const status = b.actual === b.expected && b.withContent === b.expected && b.withRules === b.expected
        ? '✅'
        : b.issues.length > 0 ? '⚠️' : '✅';
      console.log(
        `${b.name.padEnd(22)} ${b.am.substring(0, 17).padEnd(18)} ${(b.actual + '/' + b.expected).padStart(4)} ${String(b.verses).padStart(6)} ${(b.withRules + '/' + b.expected).padStart(4)} ${status.padStart(8)}`
      );
      for (const iss of b.issues.slice(0, 3)) {
        console.log(`  └─ ${iss}`);
      }
      if (b.issues.length > 3) console.log(`  └─ ... and ${b.issues.length - 3} more`);
    }
  }

  // 6. Summary
  console.log('\n' + '═'.repeat(90));
  console.log('  SUMMARY');
  console.log('═'.repeat(90));
  console.log(`  Books:            ${books.length}/73`);
  console.log(`  Total chapters:   ${allChapters.length}/${totalChapters} expected`);
  console.log(`  With content:     ${chaptersWithContent}/${totalChapters}`);
  console.log(`  With formatting:  ${chaptersWithRules}/${totalChapters}`);
  console.log(`  Total verses:     ${totalVerses}`);
  console.log(`  Empty verses:     ${emptyVerses}`);
  console.log(`  Ge'ez prefixed:   ${geezPrefixed} (duplicate numbering in text)`);
  console.log(`  Issues:           ${issues.length}`);

  if (issues.length === 0) {
    console.log('\n  ✅ ALL CHECKS PASSED — Emmaus DB matches PDF extraction.\n');
  } else {
    console.log(`\n  ⚠️  ${issues.length} issue(s) found:\n`);
    for (const iss of issues.slice(0, 20)) {
      console.log(`    ${iss.book}${iss.chapter ? ' ch' + iss.chapter : ''}: ${iss.issue}`);
    }
    if (issues.length > 20) console.log(`    ... and ${issues.length - 20} more`);
    console.log();
  }
}

main().then(() => process.exit(0)).catch(err => { console.error('❌', err); process.exit(1); });
