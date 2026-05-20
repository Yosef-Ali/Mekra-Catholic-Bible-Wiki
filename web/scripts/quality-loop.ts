/**
 * Quality Loop: Runs quality checks on all chapters and re-formats failing ones.
 * Repeats until all chapters pass quality criteria or max iterations reached.
 *
 * Quality checks:
 *   1. Chapter has content sections
 *   2. Sections contain verses
 *   3. Poetry books have poetry formatting detected
 *   4. Minimum verse count met
 *
 * Usage:
 *   npx tsx scripts/quality-loop.ts            # 3 iterations (default)
 *   npx tsx scripts/quality-loop.ts 5          # 5 iterations
 *   npx tsx scripts/quality-loop.ts --check    # Check only, no re-formatting
 */

import { config } from 'dotenv';
import { db } from '../services/db';
import { chapterContents, books } from '../services/schema';
import { eq } from 'drizzle-orm';
import { spawn } from 'child_process';

config();

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const MAX_ITERATIONS = CHECK_ONLY ? 1 : parseInt(args.find(a => /^\d+$/.test(a)) || '3');

// ─── Quality Rules ────────────────────────────────────────────────────────────

// Books where every chapter must have poetry sections
const POETRY_BOOKS = new Set([
  'Psalms', 'Job', 'Proverbs', 'Song of Songs', 'Lamentations',
]);

// Known prose chapters inside otherwise-poetry books (legitimate exceptions)
const PROSE_EXCEPTIONS = new Set([
  'Job:1', 'Job:2', 'Job:42', // Job prologue and epilogue are prose narrative
]);

// Minimum verse count per book (rough lower bounds)
const MIN_VERSES: Record<string, number> = {
  'Psalms': 3, 'Job': 5, 'Proverbs': 10, 'Song of Songs': 4,
  'Lamentations': 10, 'Philemon': 10, 'Obadiah': 15, '2 John': 8,
  '3 John': 8, 'Jude': 20,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface QualityIssue {
  bookId: number;
  bookName: string;
  chapterNumber: number;
  severity: 'error' | 'warning';
  issue: string;
}

// ─── Quality Check ────────────────────────────────────────────────────────────

function checkChapterQuality(
  bookName: string,
  bookId: number,
  chapterNumber: number,
  content: any,
  formattingRules: any,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (!content) {
    issues.push({ bookId, bookName, chapterNumber, severity: 'error', issue: 'No content stored' });
    return issues;
  }

  const sections: any[] = content.sections || [];

  // Check 1: Has sections
  if (sections.length === 0) {
    issues.push({ bookId, bookName, chapterNumber, severity: 'error', issue: 'No sections in content' });
    return issues;
  }

  // Check 2: Has verses
  const totalVerses = sections.reduce((sum: number, s: any) => sum + (s.verses?.length || 0), 0);
  if (totalVerses === 0) {
    issues.push({ bookId, bookName, chapterNumber, severity: 'error', issue: 'Sections exist but contain 0 verses' });
    return issues;
  }

  // Check 3: Poetry books must detect poetry (skip known prose exceptions)
  if (POETRY_BOOKS.has(bookName) && !PROSE_EXCEPTIONS.has(`${bookName}:${chapterNumber}`)) {
    const hasPoetrySection = sections.some((s: any) => s.type === 'poetry');
    const metadataPoetry = content.metadata?.hasPoetry === true;
    if (!hasPoetrySection && !metadataPoetry) {
      issues.push({
        bookId, bookName, chapterNumber, severity: 'error',
        issue: `Poetry book has no poetry sections (found: ${sections.map((s: any) => s.type).join(', ')})`,
      });
    }
  }

  // Check 4: Minimum verse count
  const minVerses = MIN_VERSES[bookName] ?? 1;
  if (totalVerses < minVerses) {
    issues.push({
      bookId, bookName, chapterNumber, severity: 'warning',
      issue: `Low verse count: ${totalVerses} (expected ≥ ${minVerses})`,
    });
  }

  // Check 5: All verse texts must be non-empty strings
  const emptyVerses = sections.flatMap((s: any) =>
    (s.verses || []).filter((v: any) => !v.text || typeof v.text !== 'string' || v.text.trim().length === 0)
  );
  if (emptyVerses.length > 0) {
    issues.push({
      bookId, bookName, chapterNumber, severity: 'warning',
      issue: `${emptyVerses.length} verse(s) with empty text`,
    });
  }

  // Check 6: paragraphBreaks must be set in formattingRules (warning only — fixed by generate-paragraph-breaks.ts)
  const breaks = formattingRules?.paragraphBreaks;
  if (!breaks || !Array.isArray(breaks) || breaks.length === 0) {
    issues.push({
      bookId, bookName, chapterNumber, severity: 'warning',
      issue: 'No paragraphBreaks in formattingRules',
    });
  }

  return issues;
}

// ─── Re-formatter ─────────────────────────────────────────────────────────────

function spawnFormatter(bookId: number, chapterNumber: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['tsx', 'scripts/gemini-format-analyzer.ts', bookId.toString(), chapterNumber.toString()],
      { cwd: process.cwd(), stdio: 'inherit' }
    );
    proc.on('close', code => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
    proc.on('error', reject);
  });
}

// ─── Full Quality Scan ────────────────────────────────────────────────────────

async function runQualityCheck(): Promise<{ issues: QualityIssue[]; totalChapters: number }> {
  const allChapters = await db
    .select({
      bookId: chapterContents.bookId,
      chapterNumber: chapterContents.chapterNumber,
      content: chapterContents.content,
      formattingRules: chapterContents.formattingRules,
      bookName: books.name,
    })
    .from(chapterContents)
    .leftJoin(books, eq(chapterContents.bookId, books.id))
    .orderBy(chapterContents.bookId, chapterContents.chapterNumber);

  const issues: QualityIssue[] = [];
  for (const ch of allChapters) {
    const chIssues = checkChapterQuality(
      ch.bookName ?? 'Unknown',
      ch.bookId,
      ch.chapterNumber,
      ch.content,
      ch.formattingRules,
    );
    issues.push(...chIssues);
  }
  return { issues, totalChapters: allChapters.length };
}

// ─── Print Report ─────────────────────────────────────────────────────────────

function printReport(issues: QualityIssue[], totalChapters: number) {
  if (issues.length === 0) {
    console.log(`\n✅ ALL ${totalChapters} CHAPTERS PASS QUALITY CHECKS`);
    return;
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  console.log(`\n📋 Quality Report: ${issues.length} issues in ${totalChapters} chapters`);
  console.log(`   ❌ Errors:   ${errors.length}`);
  console.log(`   ⚠️  Warnings: ${warnings.length}`);

  // Group by book
  const byBook: Record<string, QualityIssue[]> = {};
  for (const issue of issues) {
    if (!byBook[issue.bookName]) byBook[issue.bookName] = [];
    byBook[issue.bookName].push(issue);
  }

  console.log(`\n   Affected books (${Object.keys(byBook).length}):`);
  for (const [bookName, bookIssues] of Object.entries(byBook)) {
    const errCount = bookIssues.filter(i => i.severity === 'error').length;
    const warnCount = bookIssues.filter(i => i.severity === 'warning').length;
    console.log(`\n   📖 ${bookName} — ${errCount} errors, ${warnCount} warnings`);
    for (const issue of bookIssues.slice(0, 5)) {
      const icon = issue.severity === 'error' ? '❌' : '⚠️ ';
      console.log(`      ${icon} Ch ${issue.chapterNumber}: ${issue.issue}`);
    }
    if (bookIssues.length > 5) {
      console.log(`      ... and ${bookIssues.length - 5} more chapters`);
    }
  }
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔄 BIBLE QUALITY LOOP');
  console.log('='.repeat(60));
  if (CHECK_ONLY) {
    console.log('Mode: CHECK ONLY (no re-formatting)\n');
  } else {
    console.log(`Mode: CHECK + RE-FORMAT | Max iterations: ${MAX_ITERATIONS}\n`);
  }

  let lastIssueCount = Infinity;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📊 ITERATION ${iteration}/${MAX_ITERATIONS} — Scanning ${1329} chapters...`);

    const { issues, totalChapters } = await runQualityCheck();

    printReport(issues, totalChapters);

    if (issues.length === 0) break;

    // Only re-format errors (not warnings) to avoid burning API quota on minor issues
    const errors = issues.filter(i => i.severity === 'error');

    if (CHECK_ONLY || iteration === MAX_ITERATIONS || errors.length === 0) {
      if (errors.length === 0 && issues.length > 0) {
        console.log('\n✅ No errors remain (only warnings). Done.');
      } else if (iteration === MAX_ITERATIONS) {
        console.log(`\n⚠️  Max iterations reached. ${errors.length} errors and ${issues.length - errors.length} warnings remain.`);
      }
      break;
    }

    // Safety check: bail if not making progress
    if (errors.length >= lastIssueCount) {
      console.log('\n⚠️  No improvement detected. Stopping to avoid wasting API calls.');
      break;
    }
    lastIssueCount = errors.length;

    console.log(`\n🔧 Re-formatting ${errors.length} chapters with errors...`);
    let fixed = 0, failed = 0;

    for (const issue of errors) {
      try {
        process.stdout.write(`  🔄 ${issue.bookName} Ch ${issue.chapterNumber} ... `);
        await spawnFormatter(issue.bookId, issue.chapterNumber);
        process.stdout.write('✅\n');
        fixed++;
        await new Promise(r => setTimeout(r, 2000)); // Rate limit delay
      } catch {
        process.stdout.write('❌\n');
        failed++;
      }
    }

    console.log(`\n📈 Iteration ${iteration} result: ${fixed} re-formatted, ${failed} failed`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 Quality loop complete.\n');
}

main().catch(console.error);
