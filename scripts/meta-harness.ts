/**
 * Meta-Harness: Full end-to-end pipeline for Amharic Bible extraction.
 *
 * Flow per page:
 *   1. Extract (Gemini Vision OCR)
 *   2. Review (Structural check + Gemma 4 LLM)
 *   3. Fix (retry up to 2x on failure)
 *   4. Match DB (compare against existing verses)
 *   5. Seed DB (upsert if extraction is an improvement)
 *   6. Quality Check (validate DB content post-seed)
 *
 * Usage:
 *   npx tsx scripts/meta-harness.ts 49              # single page
 *   npx tsx scripts/meta-harness.ts 49 55           # page range
 *   npx tsx scripts/meta-harness.ts --book Exodus   # entire book by name
 *   npx tsx scripts/meta-harness.ts --dry-run 49    # extract + review only, no DB writes
 *   npx tsx scripts/meta-harness.ts --resume 49 55  # resume from where it stopped
 *   npx tsx scripts/meta-harness.ts --resume --book Exodus  # resume a book run
 *   npx tsx scripts/meta-harness.ts --auto          # run ALL books, auto-resume
 *   npx tsx scripts/meta-harness.ts --auto --dry-run # auto all books, no DB writes
 */

import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { extractPage, type ExtractionResult } from './test-vision.js';
import { reviewExtraction, type ReviewReport } from './reviewer-agent-ollama.js';
import { matchAgainstDB, resolveBookForPage, type MatchReport } from './db-matcher.js';
import { syncToDB, type SyncResult } from './db-sync.js';

config();

const OUTPUT_DIR = path.join(process.cwd(), 'extraction_output');
const PAGE_MAP_PATH = path.join(OUTPUT_DIR, 'page_map.json');
const SUMMARY_FILE = path.join(OUTPUT_DIR, 'harness_summary.json');
const MAX_RETRIES = 2;

/**
 * Read the last completed page from harness_summary.json.
 * Returns the page number to resume FROM (last_completed + 1), or null if no summary.
 */
function getResumePoint(rangeStart: number, rangeEnd: number): number | null {
    if (!fs.existsSync(SUMMARY_FILE)) return null;

    try {
        const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf-8'));
        if (!summary.pages || summary.pages.length === 0) return null;

        // Find the last page in our range that was already processed
        const processedPages = summary.pages
            .map((p: any) => p.page as number)
            .filter((p: number) => p >= rangeStart && p <= rangeEnd)
            .sort((a: number, b: number) => a - b);

        if (processedPages.length === 0) return null;

        const lastDone = processedPages[processedPages.length - 1];
        if (lastDone >= rangeEnd) return null; // All done

        return lastDone + 1;
    } catch {
        return null;
    }
}

interface PageResult {
    page: number;
    book: string | null;
    status: 'pass' | 'fail';
    retries: number;
    extraction: ExtractionResult;
    review: ReviewReport;
    match: MatchReport | null;
    sync: SyncResult | null;
}

// ─── Step 1-3: Extract → Review → Retry ─────────────────────────────────────

async function extractAndReview(pageNum: number): Promise<{
    extraction: ExtractionResult;
    review: ReviewReport;
    retries: number;
    passed: boolean;
}> {
    let extraction: ExtractionResult = { pages: [pageNum], chapters: [], raw_response: '' };
    let review: ReviewReport = { page: pageNum, pass: false, issues: [], llm_analysis: null, suggestion: null };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const label = attempt === 0 ? 'Extract' : `Retry #${attempt}`;
        console.log(`\n  📖 [Step 1] ${label} — Gemini Vision OCR...`);

        if (attempt > 0) {
            const cached = path.join(OUTPUT_DIR, 'pages', `page_${pageNum}.png`);
            if (fs.existsSync(cached)) fs.unlinkSync(cached);
        }

        try {
            extraction = await extractPage(pageNum);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(`  ⚠️  Extraction failed with error: ${msg}. Will retry...`);
            continue;
        }

        if (extraction.chapters.length === 0) {
            console.log(`  ⚠️  No chapters extracted, will retry...`);
            continue;
        }

        const verseCount = extraction.chapters.reduce((s, ch) => s + ch.verses.length, 0);
        console.log(`  📝 Got ${extraction.chapters.length} chapter(s), ${verseCount} verse(s)`);

        console.log(`  🔍 [Step 2] Structural check + LLM review...`);
        review = await reviewExtraction(extraction.chapters, pageNum);

        if (review.pass) {
            console.log(`  ✅ Review PASSED`);
            return { extraction, review, retries: attempt, passed: true };
        }

        console.log(`  ❌ Review FAILED: ${review.suggestion}`);
    }

    return { extraction, review, retries: MAX_RETRIES, passed: false };
}

// ─── Step 4: Match against DB ────────────────────────────────────────────────

async function matchDB(extraction: ExtractionResult, pageNum: number): Promise<MatchReport> {
    console.log(`  📊 [Step 4] Matching against existing DB data...`);
    const report = await matchAgainstDB(extraction.chapters, pageNum);

    for (const ch of report.chapters) {
        if (!ch.has_db_data) {
            console.log(`     ${ch.book_name} Ch.${ch.chapter}: NEW (no DB data yet)`);
        } else {
            console.log(`     ${ch.book_name} Ch.${ch.chapter}: ${ch.match_percentage}% match | ` +
                `DB:${ch.total_db_verses} → Extracted:${ch.total_extracted_verses} | ` +
                `${ch.is_improvement ? '🆙 IMPROVEMENT' : '✅ DB is good'}`);
        }
    }

    return report;
}

// ─── Step 5: Seed DB ─────────────────────────────────────────────────────────

async function seedDB(extraction: ExtractionResult, pageNum: number, matchReport: MatchReport): Promise<SyncResult> {
    if (!matchReport.overall_is_improvement) {
        console.log(`  ⏭️  [Step 5] Skip DB seed — existing data is already good`);
        return {
            page: pageNum,
            chapters_updated: 0,
            chapters_inserted: 0,
            chapters_skipped: matchReport.chapters.length,
            details: matchReport.chapters.map(ch => ({
                book: ch.book_name,
                chapter: ch.chapter,
                action: 'skipped' as const,
                reason: 'DB data is already good'
            }))
        };
    }

    console.log(`  💾 [Step 5] Seeding improved data into DB...`);
    const result = await syncToDB(extraction.chapters, pageNum, matchReport);

    for (const d of result.details) {
        const icon = d.action === 'updated' ? '🔄' : d.action === 'inserted' ? '✨' : '⏭️';
        console.log(`     ${icon} ${d.book} Ch.${d.chapter}: ${d.action} — ${d.reason}`);
    }

    return result;
}

// ─── Full page processing ────────────────────────────────────────────────────

async function processPage(pageNum: number, dryRun: boolean): Promise<PageResult> {
    const bookInfo = resolveBookForPage(pageNum);
    const bookLabel = bookInfo ? `${bookInfo.name} (${bookInfo.amharic})` : 'Unknown book';

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📄 Page ${pageNum} — ${bookLabel}`);
    console.log(`${'─'.repeat(60)}`);

    // Steps 1-3: Extract → Review → Retry
    const { extraction, review, retries, passed } = await extractAndReview(pageNum);

    if (!passed) {
        console.log(`  🚫 Page ${pageNum} failed extraction after ${MAX_RETRIES} retries`);
        return {
            page: pageNum, book: bookInfo?.name || null,
            status: 'fail', retries, extraction, review,
            match: null, sync: null
        };
    }

    // Save extraction JSON
    const pageFile = path.join(OUTPUT_DIR, `vision_page_${pageNum}.json`);
    fs.writeFileSync(pageFile, JSON.stringify(extraction, null, 2));

    let match: MatchReport | null = null;
    let sync: SyncResult | null = null;

    if (dryRun) {
        console.log(`  🏜️  [Dry run] Skipping DB match and seed`);
    } else {
        // Step 4: Match DB
        match = await matchDB(extraction, pageNum);

        // Step 5: Seed DB
        sync = await seedDB(extraction, pageNum, match);

        // Step 6: Quality note
        if (sync.chapters_updated > 0 || sync.chapters_inserted > 0) {
            console.log(`  ✅ [Step 6] Seeded as verified=0 — run 'npm run quality:check' to validate`);
        }
    }

    return {
        page: pageNum, book: bookInfo?.name || null,
        status: 'pass', retries, extraction, review,
        match, sync
    };
}

// ─── Harness runner ──────────────────────────────────────────────────────────

async function runHarness(startPage: number, endPage: number, dryRun: boolean, resume: boolean = false) {
    let effectiveStart = startPage;

    if (resume) {
        const resumePoint = getResumePoint(startPage, endPage);
        if (resumePoint === null && fs.existsSync(SUMMARY_FILE)) {
            const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf-8'));
            const doneInRange = (summary.pages || []).filter(
                (p: any) => p.page >= startPage && p.page <= endPage
            ).length;
            if (doneInRange === endPage - startPage + 1) {
                console.log(`\n✅ All pages ${startPage}–${endPage} already completed. Nothing to resume.`);
                return;
            }
        }
        if (resumePoint !== null) {
            effectiveStart = resumePoint;
            console.log(`\n🔄 RESUMING from page ${effectiveStart} (pages ${startPage}–${effectiveStart - 1} already done)`);
        }
    }

    const totalPages = endPage - effectiveStart + 1;
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔄 META-HARNESS: Full End-to-End Pipeline`);
    console.log(`   Pages: ${effectiveStart}–${endPage} (${totalPages} pages${resume ? ', resumed' : ''})`);
    console.log(`   Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'LIVE (will update DB)'}`);
    console.log(`   Max retries: ${MAX_RETRIES} per page`);
    console.log(`${'═'.repeat(60)}`);

    const results: PageResult[] = [];
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Load existing summary pages so we don't lose data from previous book runs
    let existingPages: any[] = [];
    if (fs.existsSync(SUMMARY_FILE)) {
        try {
            const prev = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf-8'));
            existingPages = (prev.pages || []).filter(
                (p: any) => p.page < startPage || p.page > endPage
            );
        } catch { /* ignore corrupt summary */ }
    }

    // Running counters to avoid O(n²) recomputation
    let passed = 0, failed = 0, dbUpdated = 0, dbInserted = 0, dbSkipped = 0;

    for (let page = effectiveStart; page <= endPage; page++) {
        const result = await processPage(page, dryRun);
        results.push(result);

        // Update running counters
        if (result.status === 'pass') passed++; else failed++;
        dbUpdated += result.sync?.chapters_updated || 0;
        dbInserted += result.sync?.chapters_inserted || 0;
        dbSkipped += result.sync?.chapters_skipped || 0;

        // Merge current run pages with existing pages from other book ranges
        const currentPages = results.map(r => ({
            page: r.page,
            book: r.book,
            status: r.status,
            retries: r.retries,
            chapters: r.extraction.chapters.map(ch => `${ch.book} ${ch.chapter}`),
            verses: r.extraction.chapters.reduce((s, ch) => s + ch.verses.length, 0),
            issues: r.review.issues.length,
            db_action: r.sync?.details.map(d => `${d.action}: ${d.book} Ch.${d.chapter}`) || [],
            match_pct: r.match?.chapters.map(c => `${c.book_name} Ch.${c.chapter}: ${c.match_percentage}%`) || []
        }));
        const allPages = [...existingPages, ...currentPages].sort(
            (a: any, b: any) => a.page - b.page
        );

        // Incremental summary (preserves all processed pages across books)
        const summary = {
            range: `${startPage}-${endPage}`,
            last_completed_page: page,
            mode: dryRun ? 'dry-run' : 'live',
            completed: allPages.length,
            total: totalPages,
            passed, failed,
            db_updated: dbUpdated,
            db_inserted: dbInserted,
            db_skipped: dbSkipped,
            pages: allPages
        };

        fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));
    }

    // ─── Final report ────────────────────────────────────────────────────────
    const totalVerses = results.reduce((s, r) =>
        s + r.extraction.chapters.reduce((vs, ch) => vs + ch.verses.length, 0), 0);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📊 PIPELINE COMPLETE`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`   Pages:    ${effectiveStart}–${endPage} (${results.length} processed)`);
    console.log(`   ✅ Passed: ${passed}  ❌ Failed: ${failed}`);
    console.log(`   📝 Verses: ${totalVerses} total extracted`);
    if (!dryRun) {
        console.log(`   💾 DB Updated:  ${dbUpdated}`);
        console.log(`   ✨ DB Inserted: ${dbInserted}`);
        console.log(`   ⏭️  DB Skipped: ${dbSkipped}`);
    }
    console.log(`   📄 Summary: ${SUMMARY_FILE}`);
    console.log(`${'═'.repeat(60)}`);

    if (failed > 0) {
        console.log('\n🚫 Failed pages:');
        for (const r of results.filter(r => r.status === 'fail')) {
            console.log(`   Page ${r.page} (${r.book}): ${r.review.suggestion}`);
        }
    }

    if (!dryRun && (dbUpdated > 0 || dbInserted > 0)) {
        console.log(`\n💡 Next step: Run quality check on seeded chapters:`);
        console.log(`   npm run quality:check`);
    }
}

// ─── --auto mode: run ALL books sequentially, auto-resuming ─────────────────

async function runAuto(dryRun: boolean) {
    const pageMap = JSON.parse(fs.readFileSync(PAGE_MAP_PATH, 'utf-8'));
    const books = pageMap.books as Array<{ name: string; amharic: string; start_page: number; end_page: number }>;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🤖 AUTO MODE: Processing all ${books.length} books`);
    console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Resume: enabled (picks up where it left off)`);
    console.log(`${'═'.repeat(60)}`);

    const bookResults: Array<{ name: string; pages: string; status: string }> = [];

    for (let i = 0; i < books.length; i++) {
        const book = books[i];
        console.log(`\n${'━'.repeat(60)}`);
        console.log(`📚 [${i + 1}/${books.length}] ${book.name} (${book.amharic}) — pages ${book.start_page}–${book.end_page}`);
        console.log(`${'━'.repeat(60)}`);

        // Check if this book's range is already fully done
        const resumePoint = getResumePoint(book.start_page, book.end_page);
        if (resumePoint === null && fs.existsSync(SUMMARY_FILE)) {
            const summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf-8'));
            const doneInRange = (summary.pages || []).filter(
                (p: any) => p.page >= book.start_page && p.page <= book.end_page
            ).length;
            const expectedPages = book.end_page - book.start_page + 1;
            if (doneInRange >= expectedPages) {
                console.log(`   ✅ Already complete (${doneInRange}/${expectedPages} pages). Skipping.`);
                bookResults.push({ name: book.name, pages: `${book.start_page}-${book.end_page}`, status: 'already done' });
                continue;
            }
        }

        try {
            await runHarness(book.start_page, book.end_page, dryRun, true);
            bookResults.push({ name: book.name, pages: `${book.start_page}-${book.end_page}`, status: 'done' });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`   ❌ ${book.name} failed: ${msg}`);
            bookResults.push({ name: book.name, pages: `${book.start_page}-${book.end_page}`, status: `error: ${msg}` });
            // Continue to next book instead of crashing
        }
    }

    // Auto-mode summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🏁 AUTO MODE COMPLETE`);
    console.log(`${'═'.repeat(60)}`);
    for (const b of bookResults) {
        const icon = b.status === 'done' ? '✅' : b.status === 'already done' ? '⏭️' : '❌';
        console.log(`   ${icon} ${b.name} (pp.${b.pages}): ${b.status}`);
    }
}

// ─── CLI parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const resume = args.includes('--resume');
const autoMode = args.includes('--auto');
const filteredArgs = args.filter(a => !a.startsWith('--'));

if (autoMode) {
    // --auto: process all books, auto-resume
    runAuto(dryRun).catch(err => {
        console.error('❌ Auto mode failed:', err);
        process.exit(1);
    });
} else if (args.indexOf('--book') !== -1 && args[args.indexOf('--book') + 1]) {
    // --book <name> mode
    const bookName = args[args.indexOf('--book') + 1];
    const pageMap = JSON.parse(fs.readFileSync(PAGE_MAP_PATH, 'utf-8'));
    const book = pageMap.books.find((b: any) =>
        b.name.toLowerCase() === bookName.toLowerCase() ||
        b.name.replace(/_/g, ' ').toLowerCase() === bookName.toLowerCase()
    );
    if (!book) {
        console.error(`❌ Book "${bookName}" not found in page_map.json`);
        console.log('Available books:', pageMap.books.map((b: any) => b.name).join(', '));
        process.exit(1);
    }
    console.log(`📚 Processing entire book: ${book.name} (pages ${book.start_page}–${book.end_page})`);
    runHarness(book.start_page, book.end_page, dryRun, resume).catch(err => {
        console.error('❌ Harness failed:', err);
        process.exit(1);
    });
} else {
    // Page range mode
    if (filteredArgs.length === 0) {
        console.log('Usage:');
        console.log('  npx tsx scripts/meta-harness.ts 49                  # single page');
        console.log('  npx tsx scripts/meta-harness.ts 49 55               # page range');
        console.log('  npx tsx scripts/meta-harness.ts --book Exodus       # entire book');
        console.log('  npx tsx scripts/meta-harness.ts --dry-run 49        # no DB writes');
        console.log('  npx tsx scripts/meta-harness.ts --resume 49 55      # resume from last stop');
        console.log('  npx tsx scripts/meta-harness.ts --resume --book Exodus');
        console.log('  npx tsx scripts/meta-harness.ts --auto              # ALL books, auto-resume');
        console.log('  npx tsx scripts/meta-harness.ts --auto --dry-run    # ALL books, dry run');
        process.exit(1);
    }

    const start = parseInt(filteredArgs[0], 10);
    const end = parseInt(filteredArgs[1] || filteredArgs[0], 10);

    runHarness(start, end, dryRun, resume).catch(err => {
        console.error('❌ Harness failed:', err);
        process.exit(1);
    });
}
