/**
 * DB Sync: Upserts vision-extracted verses into the database.
 * Only updates if the extraction is an improvement over existing data.
 *
 * Usage:
 *   npx tsx scripts/db-sync.ts <extracted.json>
 *   npx tsx scripts/db-sync.ts extraction_output/vision_page_49.json
 */

import { config } from 'dotenv';
import { db } from '../services/db';
import { chapterContents } from '../services/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import { matchAgainstDB, extractVersesFromDB, type MatchReport } from './db-matcher';

config();

export interface SyncResult {
  page: number;
  chapters_updated: number;
  chapters_inserted: number;
  chapters_skipped: number;
  details: Array<{
    book: string;
    chapter: number;
    action: 'inserted' | 'updated' | 'skipped';
    reason: string;
  }>;
}

/**
 * Convert vision extraction format → DB content format (sections-based)
 */
function toDBContent(verses: Array<{ verse_number: number; text: string }>) {
  return {
    sections: [{
      type: 'prose',
      subtitle_level: 'single',
      subtitle_text: '',
      verses: verses.map(v => ({
        verse_number: v.verse_number,
        text: v.text,
        is_new_paragraph: v.verse_number === 1,
        indent: 0
      }))
    }]
  };
}

/**
 * Merge extracted verses with existing DB verses (keep DB verses that extraction missed)
 */
function mergeVerses(
  dbVerses: Map<number, string>,
  extractedVerses: Array<{ verse_number: number; text: string }>
): Array<{ verse_number: number; text: string }> {
  const merged = new Map<number, string>();

  // Start with all DB verses
  for (const [num, text] of dbVerses) {
    merged.set(num, text);
  }

  // Override with extracted (newer/better) text
  for (const v of extractedVerses) {
    merged.set(v.verse_number, v.text);
  }

  // Return sorted
  return Array.from(merged.entries())
    .sort(([a], [b]) => a - b)
    .map(([verse_number, text]) => ({ verse_number, text }));
}

/**
 * Sync extracted data to database
 */
export async function syncToDB(
  extractedChapters: Array<{ book: string; chapter: number; verses: Array<{ verse_number: number; text: string }> }>,
  pageNum: number,
  matchReport?: MatchReport
): Promise<SyncResult> {
  // Get match report if not provided
  const report = matchReport || await matchAgainstDB(extractedChapters, pageNum);

  const result: SyncResult = {
    page: pageNum,
    chapters_updated: 0,
    chapters_inserted: 0,
    chapters_skipped: 0,
    details: []
  };

  for (let i = 0; i < extractedChapters.length; i++) {
    const extracted = extractedChapters[i];
    const chReport = report.chapters[i];

    if (!chReport) continue;

    // Skip if not an improvement
    if (chReport.has_db_data && !chReport.is_improvement) {
      result.chapters_skipped++;
      result.details.push({
        book: chReport.book_name,
        chapter: chReport.chapter,
        action: 'skipped',
        reason: `DB already has good data (${chReport.match_percentage}% match, ${chReport.total_db_verses} verses)`
      });
      continue;
    }

    // Use book_id from match report (already resolved, avoids duplicate DB query)
    const bookId = chReport.book_id;
    if (!bookId) {
      result.details.push({
        book: extracted.book,
        chapter: extracted.chapter,
        action: 'skipped',
        reason: 'Book not found in DB'
      });
      result.chapters_skipped++;
      continue;
    }

    // Check if chapter exists
    const existing = await db.query.chapterContents.findFirst({
      where: (c, { and, eq }) =>
        and(eq(c.bookId, bookId), eq(c.chapterNumber, extracted.chapter))
    });

    if (existing) {
      // Merge: keep DB verses that extraction missed, override with better text
      const dbVersesMap = extractVersesFromDB(existing.content);

      const mergedVerses = mergeVerses(dbVersesMap, extracted.verses);
      const content = toDBContent(mergedVerses);

      await db.update(chapterContents)
        .set({
          content: content as any,
          verified: 0, // Mark for re-review
          updatedAt: new Date()
        })
        .where(eq(chapterContents.id, existing.id));

      result.chapters_updated++;
      result.details.push({
        book: chReport.book_name,
        chapter: extracted.chapter,
        action: 'updated',
        reason: `Merged ${extracted.verses.length} extracted + ${dbVersesMap.size} DB → ${mergedVerses.length} total verses`
      });
    } else {
      // Insert new
      const content = toDBContent(extracted.verses);

      await db.insert(chapterContents).values({
        bookId: bookId,
        chapterNumber: extracted.chapter,
        content: content as any,
        style: 'prose',
        verified: 0
      });

      result.chapters_inserted++;
      result.details.push({
        book: chReport.book_name,
        chapter: extracted.chapter,
        action: 'inserted',
        reason: `New chapter with ${extracted.verses.length} verses`
      });
    }
  }

  return result;
}

// ─── CLI ───
if (process.argv[1].endsWith('db-sync.ts')) {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.log('Usage: npx tsx scripts/db-sync.ts <extracted.json>');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const chapters = data.chapters || [];
  const page = data.pages?.[0] || 0;

  syncToDB(chapters, page).then(result => {
    console.log(`\n💾 DB Sync Report — Page ${result.page}`);
    console.log(`${'═'.repeat(50)}`);
    console.log(`   Updated:  ${result.chapters_updated}`);
    console.log(`   Inserted: ${result.chapters_inserted}`);
    console.log(`   Skipped:  ${result.chapters_skipped}`);

    for (const d of result.details) {
      const icon = d.action === 'updated' ? '🔄' : d.action === 'inserted' ? '✨' : '⏭️';
      console.log(`   ${icon} ${d.book} Ch.${d.chapter}: ${d.action} — ${d.reason}`);
    }

    process.exit(0);
  }).catch(err => {
    console.error('❌', err);
    process.exit(1);
  });
}
