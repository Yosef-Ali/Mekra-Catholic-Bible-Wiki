/**
 * Stage 4: Seed validated extractions into the database.
 * Transforms the new rich extraction format into the existing DB schema,
 * populating both `content` (sections + verses) and `formatting_rules`
 * (paragraphBreaks, subtitles with level, hasPoetry).
 *
 * Usage:
 *   npx tsx scripts/bible-seed.ts              # all extracted books
 *   npx tsx scripts/bible-seed.ts Genesis      # single book
 *
 * Requires: extraction_output/raw/*.json + DATABASE_URL in .env
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

import { requireEnv, RAW_DIR } from './bible-shared';

const DATABASE_URL = requireEnv('DATABASE_URL');
const sql = neon(DATABASE_URL);

// Maps extraction file names to DB book names (English)
const NAME_MAP: Record<string, string> = {
  '1_Samuel':        '1 Samuel',
  '2_Samuel':        '2 Samuel',
  '1_Kings':         '1 Kings',
  '2_Kings':         '2 Kings',
  '1_Chronicles':    '1 Chronicles',
  '2_Chronicles':    '2 Chronicles',
  '1_Maccabees':     '1 Maccabees',
  '2_Maccabees':     '2 Maccabees',
  '1_Corinthians':   '1 Corinthians',
  '2_Corinthians':   '2 Corinthians',
  '1_Thessalonians': '1 Thessalonians',
  '2_Thessalonians': '2 Thessalonians',
  '1_Timothy':       '1 Timothy',
  '2_Timothy':       '2 Timothy',
  '1_Peter':         '1 Peter',
  '2_Peter':         '2 Peter',
  '1_John':          '1 John',
  '2_John':          '2 John',
  '3_John':          '3 John',
  'Song_of_Songs':   'Song of Solomon',
  'Wisdom':          'Wisdom of Solomon',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawVerse {
  verse_number: number;
  text: string;
  is_new_paragraph: boolean;
  indent: number;
}

interface RawSection {
  type: 'prose' | 'poetry';
  subtitle_level: string; // 'double' | 'single' | ''
  subtitle_text: string;
  verses: RawVerse[];
}

interface RawChapter {
  chapter_number: number;
  sections: RawSection[];
}

interface RawBook {
  book_name: string;
  amharic_name: string;
  chapters: RawChapter[];
}

// DB content format (existing schema — what BibleReader reads)
interface DbVerse {
  verse_number: number;
  text: string;
  indent: number;
}

interface DbSection {
  type: 'prose' | 'poetry' | 'list' | 'footnote';
  title?: string;
  verses: DbVerse[];
}

interface DbContent {
  sections: DbSection[];
  metadata: {
    hasPoetry: boolean;
    hasLists: boolean;
    hasFootnotes: boolean;
    verseCount: number;
  };
}

// formatting_rules format (extended with subtitle level)
interface DbFormattingRules {
  hasPoetry: boolean;
  hasLists: boolean;
  primaryStyle: string;
  paragraphBreaks: number[];
  subtitles: { verse: number; text: string; level: 'double' | 'single' }[];
}

// ─── Transform ────────────────────────────────────────────────────────────────

function transformChapter(ch: RawChapter): { content: DbContent; formattingRules: DbFormattingRules } {
  const hasPoetry = ch.sections.some(s => s.type === 'poetry');
  let verseCount = 0;

  // Build DB content sections
  const dbSections: DbSection[] = ch.sections.map(sec => {
    const verses: DbVerse[] = sec.verses.map(v => ({
      verse_number: v.verse_number,
      text: v.text,
      indent: v.indent,
    }));
    verseCount += verses.length;

    const section: DbSection = { type: sec.type, verses };
    if (sec.subtitle_text) section.title = sec.subtitle_text;
    return section;
  });

  const content: DbContent = {
    sections: dbSections,
    metadata: {
      hasPoetry,
      hasLists: false,
      hasFootnotes: false,
      verseCount,
    },
  };

  // Build formatting_rules
  const paragraphBreaks: number[] = [];
  const subtitles: { verse: number; text: string; level: 'double' | 'single' }[] = [];

  for (const sec of ch.sections) {
    // Collect paragraph break verse numbers
    for (const v of sec.verses) {
      if (v.is_new_paragraph) paragraphBreaks.push(v.verse_number);
    }

    // Collect subtitle metadata
    if (sec.subtitle_text && sec.verses.length > 0) {
      const firstVerse = sec.verses[0].verse_number;
      const level = (sec.subtitle_level === 'double' || sec.subtitle_level === 'single')
        ? sec.subtitle_level as 'double' | 'single'
        : 'single';
      subtitles.push({ verse: firstVerse, text: sec.subtitle_text, level });
    }
  }

  const formattingRules: DbFormattingRules = {
    hasPoetry,
    hasLists: false,
    primaryStyle: hasPoetry ? 'poetry' : 'prose',
    paragraphBreaks,
    subtitles,
  };

  return { content, formattingRules };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedBook(filePath: string): Promise<{ seeded: number; skipped: number; failed: number }> {
  const raw: RawBook = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const dbName = NAME_MAP[raw.book_name] ?? raw.book_name.replace(/_/g, ' ');

  // Find book in DB
  const bookRows = await sql`SELECT id, name FROM books WHERE name = ${dbName} LIMIT 1`;
  if (bookRows.length === 0) {
    console.error(`  ❌ Book not found in DB: "${dbName}"`);
    return { seeded: 0, skipped: 0, failed: raw.chapters.length };
  }

  const bookId: number = bookRows[0].id;
  let seeded = 0, skipped = 0, failed = 0;

  for (const ch of raw.chapters) {
    try {
      const { content, formattingRules } = transformChapter(ch);

      // Upsert — insert or update if already exists
      await sql`
        INSERT INTO formatted_chapter_contents
          (book_id, chapter_number, content, formatting_rules, style, verified, updated_at)
        VALUES (
          ${bookId},
          ${ch.chapter_number},
          ${JSON.stringify(content)}::jsonb,
          ${JSON.stringify(formattingRules)}::jsonb,
          ${formattingRules.hasPoetry ? 'poetry' : 'prose'},
          0,
          NOW()
        )
        ON CONFLICT (book_id, chapter_number)
        DO UPDATE SET
          content          = EXCLUDED.content,
          formatting_rules = EXCLUDED.formatting_rules,
          style            = EXCLUDED.style,
          updated_at       = NOW()
      `;
      seeded++;
    } catch (err: any) {
      console.error(`  ❌ ch.${ch.chapter_number}: ${err.message}`);
      failed++;
    }
  }

  return { seeded, skipped, failed };
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    console.error('❌ No raw extractions. Run bible-extract.ts first.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const files = fs.readdirSync(RAW_DIR)
    .filter(f => f.endsWith('.json'))
    .filter(f => args.length === 0 || args.includes(f.replace('.json', '')))
    .sort();

  if (files.length === 0) {
    console.error('❌ No matching files found.');
    process.exit(1);
  }

  console.log(`\n🌱 Seeding ${files.length} book(s) to database...\n`);
  console.log('='.repeat(65));
  console.log(`${'Book'.padEnd(22)} ${'Seeded'.padStart(8)} ${'Failed'.padStart(8)}`);
  console.log('='.repeat(65));

  let totalSeeded = 0, totalFailed = 0;

  for (const file of files) {
    const bookName = file.replace('.json', '');
    process.stdout.write(`${bookName.padEnd(22)} `);

    try {
      const { seeded, failed } = await seedBook(path.join(RAW_DIR, file));
      totalSeeded += seeded;
      totalFailed += failed;
      const status = failed > 0 ? `⚠️  ${seeded}ch / ${failed} failed` : `✅ ${seeded} chapters`;
      console.log(`${String(seeded).padStart(8)} ${String(failed).padStart(8)}   ${status}`);
    } catch (err: any) {
      console.log(`${'—'.padStart(8)} ${'ERR'.padStart(8)}   ❌ ${err.message}`);
      totalFailed++;
    }
  }

  console.log('='.repeat(65));
  console.log(`\n✅ Done: ${totalSeeded} chapters seeded, ${totalFailed} failed`);
}

main().catch(console.error);
