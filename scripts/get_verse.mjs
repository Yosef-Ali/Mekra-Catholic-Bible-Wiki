#!/usr/bin/env node
/**
 * get_verse.mjs — query the Mekra Bible (Neon DB) from the wiki.
 *
 * The Bible text lives in the Mekra app's Neon Postgres, NOT in this wiki.
 * This script is the bridge: the wiki stores teaching/synthesis, the DB
 * stores raw verses. Claude uses this script when it needs to quote a
 * specific verse during a query.
 *
 * Usage:
 *   node scripts/get_verse.mjs <book> [chapter] [verse|range]
 *
 * Examples:
 *   node scripts/get_verse.mjs Matthew                 # book metadata
 *   node scripts/get_verse.mjs Matthew 5               # full chapter
 *   node scripts/get_verse.mjs Matthew 5 3             # single verse
 *   node scripts/get_verse.mjs Matthew 5 3-12          # verse range
 *   node scripts/get_verse.mjs ማቴዎስ 5 3                # Amharic name works
 *   node scripts/get_verse.mjs --list                  # list all 73 books
 *
 * Output: JSON to stdout. Errors to stderr, non-zero exit code.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'node:fs';

// Load DATABASE_URL from the Mekra app's .env (single source of truth)
const APP_ENV = '/Users/mekdesyared/Mekra-Catholic-Bible/.env';
if (!process.env.DATABASE_URL && existsSync(APP_ENV)) {
  for (const line of readFileSync(APP_ENV, 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) {
      process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, '');
      break;
    }
  }
}
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in env or ' + APP_ENV);
  process.exit(2);
}

const sql = neon(process.env.DATABASE_URL);
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.error('Usage: node scripts/get_verse.mjs <book> [chapter] [verse|range]');
  console.error('       node scripts/get_verse.mjs --list');
  process.exit(1);
}

try {
  if (args[0] === '--list') {
    const rows = await sql`
      SELECT id, name, amharic_name, chapters, section
      FROM books ORDER BY id
    `;
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  }

  const [bookArg, chapterArg, verseArg] = args;

  // Resolve book by English name OR Amharic name (case-insensitive, partial OK)
  const books = await sql`
    SELECT id, name, amharic_name, chapters, section
    FROM books
    WHERE LOWER(name) = LOWER(${bookArg})
       OR amharic_name = ${bookArg}
       OR LOWER(name) LIKE LOWER(${bookArg + '%'})
       OR amharic_name LIKE ${bookArg + '%'}
    ORDER BY id
    LIMIT 5
  `;
  if (books.length === 0) {
    console.error(`ERROR: book not found: "${bookArg}". Try --list.`);
    process.exit(3);
  }
  if (books.length > 1) {
    const exact = books.find(
      b => b.name.toLowerCase() === bookArg.toLowerCase() || b.amharic_name === bookArg
    );
    if (!exact) {
      console.error('AMBIGUOUS book match. Candidates:');
      console.error(JSON.stringify(books, null, 2));
      process.exit(4);
    }
    books.splice(0, books.length, exact);
  }
  const book = books[0];

  // Book-only query → return metadata
  if (!chapterArg) {
    console.log(JSON.stringify(book, null, 2));
    process.exit(0);
  }

  const chapterNum = parseInt(chapterArg, 10);
  if (!Number.isFinite(chapterNum) || chapterNum < 1 || chapterNum > book.chapters) {
    console.error(`ERROR: invalid chapter ${chapterArg} for ${book.name} (1–${book.chapters})`);
    process.exit(5);
  }

  const chapterRows = await sql`
    SELECT id, book_id, chapter_number, content, style
    FROM formatted_chapter_contents
    WHERE book_id = ${book.id} AND chapter_number = ${chapterNum}
    LIMIT 1
  `;
  if (chapterRows.length === 0) {
    console.error(
      `ERROR: ${book.name} ${chapterNum} not found in DB ` +
        `(book has ${book.chapters} chapters declared, content row missing)`
    );
    process.exit(6);
  }
  const chapter = chapterRows[0];

  // Defensively extract verses from JSONB ExtractionResult shapes.
  // Real shape: { sections: [ { type, verses: [{ text, verse_number, ... }] } ] }
  function extractVerses(content) {
    if (!content) return [];
    if (Array.isArray(content)) return content.flatMap(extractVerses);
    if (Array.isArray(content.verses)) {
      return content.verses.map(v => ({ ...v, section_type: content.type ?? null }));
    }
    if (Array.isArray(content.sections)) return content.sections.flatMap(extractVerses);
    if (Array.isArray(content.content)) return content.content.flatMap(extractVerses);
    return [];
  }
  const allVerses = extractVerses(chapter.content);

  // No verse arg → return the whole chapter
  if (!verseArg) {
    console.log(
      JSON.stringify(
        {
          book: book.name,
          amharic_name: book.amharic_name,
          chapter: chapterNum,
          style: chapter.style,
          verse_count: allVerses.length,
          verses: allVerses,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  // Verse or range
  let start, end;
  if (verseArg.includes('-')) {
    [start, end] = verseArg.split('-').map(n => parseInt(n, 10));
  } else {
    start = end = parseInt(verseArg, 10);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
    console.error(`ERROR: invalid verse spec "${verseArg}" (use N or N-M)`);
    process.exit(7);
  }

  const filtered = allVerses.filter(v => {
    const num = v.verse ?? v.number ?? v.verse_number ?? v.v;
    return num >= start && num <= end;
  });

  console.log(
    JSON.stringify(
      {
        book: book.name,
        amharic_name: book.amharic_name,
        chapter: chapterNum,
        verse_range: start === end ? `${start}` : `${start}-${end}`,
        count: filtered.length,
        verses: filtered,
      },
      null,
      2
    )
  );
  process.exit(0);
} catch (err) {
  console.error('DB ERROR:', err.message);
  process.exit(99);
}
