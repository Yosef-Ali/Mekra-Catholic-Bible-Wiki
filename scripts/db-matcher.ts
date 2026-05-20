/**
 * DB Matcher: Compares vision-extracted verses against existing DB content.
 * Reports match percentage, missing verses, and improvements found.
 *
 * Usage:
 *   npx tsx scripts/db-matcher.ts <extracted.json>
 *   npx tsx scripts/db-matcher.ts extraction_output/vision_page_49.json
 */

import { config } from 'dotenv';
import { db } from '../services/db';
import { chapterContents } from '../services/schema';
import fs from 'fs';
import path from 'path';

config();

// Lazy-load page map (read once on first use)
type BookEntry = { name: string; amharic: string; start_page: number; end_page: number; expected_chapters: number };
let _pageMap: { books: BookEntry[] } | null = null;
function getPageMap() {
  if (!_pageMap) {
    const p = path.join(process.cwd(), 'extraction_output', 'page_map.json');
    _pageMap = JSON.parse(fs.readFileSync(p, 'utf-8'));
  }
  return _pageMap!;
}

export interface VerseMatch {
  verse_number: number;
  status: 'exact' | 'improved' | 'new' | 'missing_in_extraction';
  extracted_text?: string;
  db_text?: string;
  similarity?: number;
}

export interface ChapterMatchReport {
  book_name: string;
  book_id: number | null;
  chapter: number;
  has_db_data: boolean;
  total_db_verses: number;
  total_extracted_verses: number;
  exact_matches: number;
  improved: number;
  new_verses: number;
  missing_in_extraction: number;
  match_percentage: number;
  is_improvement: boolean;
  verses: VerseMatch[];
}

export interface MatchReport {
  page: number;
  chapters: ChapterMatchReport[];
  overall_is_improvement: boolean;
}

/**
 * Resolve which book a PDF page belongs to using page_map.json
 */
export function resolveBookForPage(pageNum: number): { name: string; amharic: string } | null {
  for (const book of getPageMap().books) {
    if (pageNum >= book.start_page && pageNum <= book.end_page) {
      return { name: book.name, amharic: book.amharic };
    }
  }
  return null;
}

/**
 * Simple character-level similarity (Dice coefficient on bigrams)
 */
function textSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };

  const setA = bigrams(a.trim());
  const setB = bigrams(b.trim());
  let intersection = 0;
  for (const bg of setA) { if (setB.has(bg)) intersection++; }
  return (2 * intersection) / (setA.size + setB.size);
}

/**
 * Extract verse text from DB content (handles both old and new formats)
 */
export function extractVersesFromDB(content: any): Map<number, string> {
  const verses = new Map<number, string>();
  if (!content) return verses;

  // New format: content.sections[].verses[]
  const sections = content.sections || [];
  for (const section of sections) {
    const sectionVerses = section.verses || [];
    for (const v of sectionVerses) {
      if (v.verse_number && v.text) {
        verses.set(v.verse_number, v.text);
      }
    }
  }

  // Old format: content[] array of ExtractedItems
  if (verses.size === 0 && Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'verse' && item.number && item.text) {
        verses.set(item.number, item.text);
      }
    }
  }

  return verses;
}

/**
 * Match extracted chapters against DB content
 */
export async function matchAgainstDB(
  extractedChapters: Array<{ book: string; chapter: number; verses: Array<{ verse_number: number; text: string }> }>,
  pageNum: number
): Promise<MatchReport> {
  const chapterReports: ChapterMatchReport[] = [];

  // Resolve once per page (same page for all chapters)
  const bookInfo = resolveBookForPage(pageNum);

  for (const extracted of extractedChapters) {
    const bookSearchName = bookInfo?.name?.replace(/_/g, ' ') || extracted.book;

    // Find book in DB
    const bookRecord = await db.query.books.findFirst({
      where: (b, { or, eq }) =>
        or(
          eq(b.name, bookSearchName),
          eq(b.amharicName, extracted.book),
          eq(b.amharicName, bookInfo?.amharic || '')
        )
    });

    if (!bookRecord) {
      chapterReports.push({
        book_name: extracted.book,
        book_id: null,
        chapter: extracted.chapter,
        has_db_data: false,
        total_db_verses: 0,
        total_extracted_verses: extracted.verses.length,
        exact_matches: 0,
        improved: 0,
        new_verses: extracted.verses.length,
        missing_in_extraction: 0,
        match_percentage: 0,
        is_improvement: true, // New data is always an improvement over nothing
        verses: extracted.verses.map(v => ({
          verse_number: v.verse_number,
          status: 'new' as const,
          extracted_text: v.text
        }))
      });
      continue;
    }

    // Find existing chapter in DB
    const dbChapter = await db.query.chapterContents.findFirst({
      where: (c, { and, eq }) =>
        and(eq(c.bookId, bookRecord.id), eq(c.chapterNumber, extracted.chapter))
    });

    const dbVerses = dbChapter ? extractVersesFromDB(dbChapter.content) : new Map<number, string>();
    const extractedVerses = new Map(extracted.verses.map(v => [v.verse_number, v.text]));

    const verseMatches: VerseMatch[] = [];
    let exact = 0, improved = 0, newV = 0, missingInExtraction = 0;

    // Check all extracted verses against DB
    for (const [num, text] of extractedVerses) {
      const dbText = dbVerses.get(num);
      if (!dbText) {
        verseMatches.push({ verse_number: num, status: 'new', extracted_text: text });
        newV++;
      } else {
        const sim = textSimilarity(text, dbText);
        if (sim >= 0.98) {
          verseMatches.push({ verse_number: num, status: 'exact', extracted_text: text, db_text: dbText, similarity: sim });
          exact++;
        } else {
          verseMatches.push({
            verse_number: num,
            status: 'improved',
            extracted_text: text,
            db_text: dbText,
            similarity: sim
          });
          improved++;
        }
      }
    }

    // Check for DB verses missing from extraction
    for (const [num] of dbVerses) {
      if (!extractedVerses.has(num)) {
        verseMatches.push({ verse_number: num, status: 'missing_in_extraction', db_text: dbVerses.get(num) });
        missingInExtraction++;
      }
    }

    const totalChecked = Math.max(dbVerses.size, extractedVerses.size);
    const matchPct = totalChecked > 0 ? (exact / totalChecked) * 100 : 0;

    // It's an improvement if:
    // - We have more verses than DB, OR
    // - We found improved text, AND
    // - We're not missing too many DB verses
    const isImprovement = (
      (newV > 0 || improved > 0) &&
      missingInExtraction <= extractedVerses.size * 0.1 // Don't lose more than 10%
    );

    chapterReports.push({
      book_name: bookRecord.name,
      book_id: bookRecord.id,
      chapter: extracted.chapter,
      has_db_data: dbVerses.size > 0,
      total_db_verses: dbVerses.size,
      total_extracted_verses: extractedVerses.size,
      exact_matches: exact,
      improved,
      new_verses: newV,
      missing_in_extraction: missingInExtraction,
      match_percentage: Math.round(matchPct * 10) / 10,
      is_improvement: isImprovement,
      verses: verseMatches.sort((a, b) => a.verse_number - b.verse_number)
    });
  }

  return {
    page: pageNum,
    chapters: chapterReports,
    overall_is_improvement: chapterReports.some(c => c.is_improvement)
  };
}

// ─── CLI ───
if (process.argv[1].endsWith('db-matcher.ts')) {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.log('Usage: npx tsx scripts/db-matcher.ts <extracted.json>');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const chapters = data.chapters || [];
  const page = data.pages?.[0] || 0;

  matchAgainstDB(chapters, page).then(report => {
    console.log(`\n📊 DB Match Report — Page ${report.page}`);
    console.log(`${'═'.repeat(50)}`);

    for (const ch of report.chapters) {
      const icon = ch.is_improvement ? '🆙' : '✅';
      console.log(`\n${icon} ${ch.book_name} Ch.${ch.chapter}`);
      console.log(`   DB verses: ${ch.total_db_verses} | Extracted: ${ch.total_extracted_verses}`);
      console.log(`   Exact: ${ch.exact_matches} | Improved: ${ch.improved} | New: ${ch.new_verses} | Missing: ${ch.missing_in_extraction}`);
      console.log(`   Match: ${ch.match_percentage}% | Is improvement: ${ch.is_improvement}`);

      if (ch.improved > 0) {
        console.log(`   📝 Changed verses:`);
        ch.verses.filter(v => v.status === 'improved').slice(0, 3).forEach(v => {
          console.log(`      v${v.verse_number}: sim=${(v.similarity! * 100).toFixed(0)}%`);
          console.log(`        DB:  ${v.db_text?.slice(0, 60)}...`);
          console.log(`        New: ${v.extracted_text?.slice(0, 60)}...`);
        });
      }
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`Overall improvement: ${report.overall_is_improvement ? 'YES 🆙' : 'NO (DB is already good)'}`);
    process.exit(0);
  }).catch(err => {
    console.error('❌', err);
    process.exit(1);
  });
}
