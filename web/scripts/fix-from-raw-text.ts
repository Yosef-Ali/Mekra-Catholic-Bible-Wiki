/**
 * Fix chapters by parsing layout-marked PDF text directly (no Gemini needed).
 * Stores minimal structure in DB, then format-analyzer.ts can polish it.
 *
 * Handles the layout format from extract-layout.py:
 *   [PAGE N]    = page boundary
 *   [HEAD]      = chapter heading (ምዕራፍ N) or section heading
 *   [VERSE]     = verse text (may start with verse number)
 *   [POETRY]    = poetry line
 *   [PARA]      = paragraph break signal
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

function extractLayoutText(startPage: number, endPage: number, bookName: string): string {
  const cmd = `python3 scripts/extract-layout.py ${startPage} ${endPage} "${bookName}"`;
  const output = execSync(cmd, { cwd: process.cwd(), maxBuffer: 50 * 1024 * 1024, timeout: 60000 });
  return JSON.parse(output.toString()).full_enriched as string;
}

interface ParsedVerse {
  verse_number: number;
  text: string;
  indent: number;
  type: 'prose' | 'poetry';
  is_new_paragraph: boolean;
}

interface ParsedChapter {
  chapter_number: number;
  verses: ParsedVerse[];
}

// Ethiopic numerals → Arabic
const ETHIOPIC_MAP: Record<string, number> = {
  '፩': 1, '፪': 2, '፫': 3, '፬': 4, '፭': 5, '፮': 6, '፯': 7, '፰': 8, '፱': 9,
  '፲': 10, '፳': 20, '፴': 30, '፵': 40, '፶': 50, '፷': 60, '፸': 70, '፹': 80, '፺': 90, '፻': 100,
};

function parseEthiopicNumber(s: string): number | null {
  if (/^\d+$/.test(s)) return parseInt(s);
  let val = 0;
  for (const ch of s) {
    if (ETHIOPIC_MAP[ch] !== undefined) val += ETHIOPIC_MAP[ch];
    else return null;
  }
  return val || null;
}

function parseLayoutText(enrichedText: string): ParsedChapter[] {
  const lines = enrichedText.split('\n');
  const chapters: ParsedChapter[] = [];
  // Start with a default chapter 1 for single-chapter books (will be replaced if heading found)
  const defaultChapter: ParsedChapter = { chapter_number: 1, verses: [] };
  let currentChapter: ParsedChapter = defaultChapter;
  let hasExplicitChapterHeading = false;
  let currentVerseNum = 0;
  let currentVerseText = '';
  let currentType: 'prose' | 'poetry' = 'prose';
  let nextIsParagraph = false;
  let indent = 0;

  function flushVerse() {
    const text = currentVerseText.trim();
    if (currentVerseNum > 0 && text.length > 0) {
      currentChapter.verses.push({
        verse_number: currentVerseNum,
        text,
        indent,
        type: currentType,
        is_new_paragraph: nextIsParagraph,
      });
      nextIsParagraph = false;
    }
    currentVerseText = '';
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Page boundary — ignore
    if (line.startsWith('[PAGE ')) continue;

    // Paragraph break signal
    if (line === '[PARA]') {
      nextIsParagraph = true;
      continue;
    }

    // Chapter heading
    if (line.startsWith('[HEAD]')) {
      const headText = line.replace('[HEAD]', '').trim();
      // Check for "ምዕራፍ N" pattern
      const chMatch = headText.match(/ምዕራፍ\s+([፩፪፫፬፭፮፯፰፱፲፳፴፵፶፷፸፹፺፻\d]+)/);
      if (chMatch) {
        const chapNum = parseEthiopicNumber(chMatch[1]);
        if (chapNum !== null) {
          // Flush current verse and start new chapter
          flushVerse();
          if (!hasExplicitChapterHeading && defaultChapter.verses.length === 0) {
            // First chapter heading found before any verses — use it instead of default
            defaultChapter.chapter_number = chapNum;
            hasExplicitChapterHeading = true;
            chapters.push(defaultChapter);
          } else {
            const newCh: ParsedChapter = { chapter_number: chapNum, verses: [] };
            currentChapter = newCh;
            chapters.push(newCh);
            hasExplicitChapterHeading = true;
          }
          currentVerseNum = 0;
          currentVerseText = '';
          currentType = 'prose';
          indent = 0;
          continue;
        }
      }
      // Non-chapter heading — treat as section title (skip or use as subtitle)
      continue;
    }

    // Poetry line
    if (line.startsWith('[POETRY]')) {
      const verseText = line.replace('[POETRY]', '').trim();

      // Try to detect verse number at start
      const numMatch = verseText.match(/^(\d+)\s+(.+)/);
      if (numMatch) {
        const newVerseNum = parseInt(numMatch[1]);
        if (newVerseNum > 200) { continue; } // page number artifact
        if (newVerseNum !== currentVerseNum) {
          flushVerse();
          currentVerseNum = newVerseNum;
          currentVerseText = numMatch[2];
          currentType = 'poetry';
          indent = 1;
        } else {
          // Continuation
          currentVerseText += (currentVerseText ? ' ' : '') + verseText;
        }
      } else {
        // Continuation of current verse as poetry
        if (currentVerseNum > 0) {
          currentType = 'poetry';
          indent = 1;
          currentVerseText += (currentVerseText ? ' ' : '') + verseText;
        }
      }
      continue;
    }

    // Regular verse line
    if (line.startsWith('[VERSE]')) {
      const verseText = line.replace('[VERSE]', '').trim();

      // Try to detect verse number at start: "1 text..." or "1. text..."
      const numMatch = verseText.match(/^(\d+)[\.\s]\s*(.+)/);
      if (numMatch) {
        const newVerseNum = parseInt(numMatch[1]);
        if (newVerseNum > 200) { continue; } // page number artifact
        if (newVerseNum !== currentVerseNum) {
          flushVerse();
          currentVerseNum = newVerseNum;
          currentVerseText = numMatch[2];
          currentType = 'prose';
          indent = 0;
        } else {
          // Same verse number — continuation
          currentVerseText += (currentVerseText ? ' ' : '') + numMatch[2];
        }
      } else {
        // No verse number — continuation of current verse
        if (currentVerseNum > 0) {
          currentVerseText += (currentVerseText ? ' ' : '') + verseText;
        }
      }
      continue;
    }

    // Fallback: plain text with verse number
    if (currentChapter) {
      const numMatch = line.match(/^(\d+)[\.\s]\s*(.+)/);
      if (numMatch) {
        const newVerseNum = parseInt(numMatch[1]);
        if (newVerseNum !== currentVerseNum) {
          flushVerse();
          currentVerseNum = newVerseNum;
          currentVerseText = numMatch[2];
          currentType = 'prose';
          indent = 0;
        } else {
          currentVerseText += (currentVerseText ? ' ' : '') + numMatch[2];
        }
      }
    }
  }

  // Flush last verse
  flushVerse();

  // Single-chapter books: if no explicit chapter heading found but defaultChapter has verses
  if (!hasExplicitChapterHeading && defaultChapter.verses.length > 0) {
    return [defaultChapter];
  }

  return chapters.filter(c => c.verses.length > 0);
}

function buildDbContent(chapter: ParsedChapter): { content: any; formattingRules: any } {
  // Group consecutive verses by type into sections
  const sections: any[] = [];
  let currentSection: any | null = null;

  for (const verse of chapter.verses) {
    if (!currentSection || currentSection.type !== verse.type) {
      currentSection = { type: verse.type, verses: [] };
      sections.push(currentSection);
    }
    currentSection.verses.push({
      verse_number: verse.verse_number,
      text: verse.text,
      indent: verse.indent,
    });
  }

  const hasPoetry = sections.some(s => s.type === 'poetry');
  const totalVerses = chapter.verses.length;

  // Paragraph breaks = first verse of each section (cap at 200 to exclude page number artifacts)
  const paragraphBreaks: number[] = [];
  for (const s of sections) {
    if (s.verses.length > 0) {
      const first = s.verses[0].verse_number;
      if (first > 0 && first <= 200 && !paragraphBreaks.includes(first)) paragraphBreaks.push(first);
    }
  }
  // Also filter out artifact verse numbers from the sections themselves
  for (const s of sections) {
    s.verses = s.verses.filter((v: any) => v.verse_number <= 200 && v.text.length > 2);
  }
  paragraphBreaks.sort((a, b) => a - b);

  return {
    content: {
      sections,
      metadata: { hasPoetry, hasLists: false, hasFootnotes: false, verseCount: totalVerses }
    },
    formattingRules: { paragraphBreaks, hasPoetry, hasLists: false, hasFootnotes: false }
  };
}

async function fixBook(bookName: string, startPage: number, endPage: number, specificChapter?: number) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📖 Fixing ${bookName} (PDF pages ${startPage}–${endPage})`);

  const [book] = await sql`SELECT id, name FROM books WHERE name = ${bookName}`;
  if (!book) { console.error(`  ❌ Book not found`); return; }

  const existingRows = await sql`
    SELECT chapter_number, formatting_rules FROM formatted_chapter_contents
    WHERE book_id = ${book.id} ORDER BY chapter_number
  `;
  const existingNums = new Set(existingRows.map((r: any) => r.chapter_number));

  console.log(`  📄 Extracting from PDF...`);
  const enrichedText = extractLayoutText(startPage, endPage, bookName);
  console.log(`  → ${Math.round(enrichedText.length / 1024)}KB`);

  console.log(`  🔍 Parsing layout markers...`);
  const chapters = parseLayoutText(enrichedText);
  console.log(`  → Chapters found: ${chapters.map(c => c.chapter_number).join(', ')}`);

  let updated = 0;
  for (const chapter of chapters) {
    if (specificChapter !== undefined && chapter.chapter_number !== specificChapter) continue;
    if (!existingNums.has(chapter.chapter_number)) { console.log(`  ⏭️  Ch ${chapter.chapter_number} not in DB`); continue; }

    const { content, formattingRules } = buildDbContent(chapter);
    const totalVerses = chapter.verses.length;

    // Preserve existing formattingRules metadata (subtitles etc), only replace what we computed
    const [existingRow] = existingRows.filter((r: any) => r.chapter_number === chapter.chapter_number);
    const existingRules = (existingRow?.formatting_rules as any) || {};
    const mergedRules = { ...existingRules, ...formattingRules };

    await sql`
      UPDATE formatted_chapter_contents
      SET
        content = ${JSON.stringify(content)}::jsonb,
        formatting_rules = ${JSON.stringify(mergedRules)}::jsonb,
        verified = 1,
        updated_at = NOW()
      WHERE book_id = ${book.id} AND chapter_number = ${chapter.chapter_number}
    `;
    console.log(`  ✅ Ch ${chapter.chapter_number}: ${totalVerses} verses, poetry=${content.metadata.hasPoetry}, breaks=[${formattingRules.paragraphBreaks.join(',')}]`);
    updated++;
  }
  console.log(`  💾 Updated ${updated} chapter(s)`);
}

// ─── Books to fix ─────────────────────────────────────────────────────────────
const BOOKS_TO_FIX: Array<{ name: string; startPage: number; endPage: number }> = [
  { name: 'Baruch',   startPage: 460, endPage: 463 },
  { name: 'Obadiah',  startPage: 508, endPage: 508 },
  { name: 'Jonah',    startPage: 509, endPage: 510 },
  { name: 'Philemon', startPage: 651, endPage: 651 },
  { name: 'Hebrews',  startPage: 652, endPage: 657 },
  { name: 'Jude',     startPage: 670, endPage: 670 },
  { name: 'Proverbs', startPage: 358, endPage: 371 },
];

async function main() {
  const args = process.argv.slice(2);
  const targetBook = args[0];

  const toFix = targetBook
    ? BOOKS_TO_FIX.filter(b => b.name.toLowerCase() === targetBook.toLowerCase())
    : BOOKS_TO_FIX;

  if (toFix.length === 0) {
    console.error(`Book "${targetBook}" not in fix list. Options: ${BOOKS_TO_FIX.map(b => b.name).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🔧 Fixing ${toFix.length} book(s) using direct PDF text parsing\n`);

  for (const book of toFix) {
    try {
      await fixBook(book.name, book.startPage, book.endPage);
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.error(`❌ ${book.name}: ${err.message}`);
    }
  }

  console.log('\n✅ Done! Run pnpm quality:check to verify, then pnpm quality:loop to polish with Gemini.');
}

main().catch(console.error);
