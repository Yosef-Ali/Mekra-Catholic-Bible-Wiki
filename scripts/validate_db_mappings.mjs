#!/usr/bin/env node
/**
 * validate_db_mappings.mjs — systematic cross-contamination checker
 *
 * For every book in the Neon DB, samples ch1v1 and compares the text
 * against known-expected opening phrases to detect mis-mapped chapters.
 *
 * Also checks the Pauline corpus (Romans–Philemon) chapter-by-chapter
 * for the off-by-one shift pattern found in today's investigation.
 *
 * Output: JSON report to stdout.
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'node:fs';

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
  console.error('ERROR: DATABASE_URL not found');
  process.exit(2);
}

const sql = neon(process.env.DATABASE_URL);

// Known ch1v1 fingerprint phrases for identification
const FINGERPRINTS = {
  'Romans': 'ሮሜ',
  '1 Corinthians': 'ቆሮንቶስ',
  '2 Corinthians': 'አካይያ',
  'Galatians': 'ሐዋርያ የሆንሁ ጳውሎስ',
  'Ephesians': 'ኤፌሶን',
  'Philippians': 'ፊልጵስዩስ',
  'Colossians': 'ቆላስይስ',
  '1 Thessalonians': 'ተሰሎንቄ',
  '1 Timothy': 'ጢሞቴዎስ',
  'Titus': 'ቲቶ',
  'Philemon': 'ፊልሞና',
  'James': 'ያዕቆብ',
  '1 Peter': 'ጴጥሮስ',
  '1 John': 'የሕይወት ቃል',
  'Revelation': 'ዮሐንስ ራእይ|ኢየሱስ ክርስቶስ ራእይ',
};

// Books that share an author — prone to mixing
const PAULINE_SHIFT_RISK = [
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
  'Ephesians', 'Philippians', 'Colossians',
  '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon'
];

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

async function main() {
  const books = await sql`SELECT id, name, amharic_name, chapters, section FROM books ORDER BY id`;
  
  const report = {
    scanned_at: new Date().toISOString(),
    total_books: books.length,
    issues: [],
    pauline_shift: [],
  };

  // 1. Ch1v1 fingerprint check for all NT books
  console.error('=== Phase 1: ch1v1 fingerprint check ===');
  for (const book of books) {
    if (book.section !== 'NT') continue;
    
    const rows = await sql`
      SELECT content FROM formatted_chapter_contents 
      WHERE book_id = ${book.id} AND chapter_number = 1 LIMIT 1
    `;
    if (rows.length === 0) {
      report.issues.push({
        book: book.name,
        severity: 'error',
        type: 'missing_chapter',
        detail: 'No chapter 1 found in DB'
      });
      continue;
    }
    
    const verses = extractVerses(rows[0].content);
    if (verses.length === 0) {
      report.issues.push({
        book: book.name,
        severity: 'warn',
        type: 'empty_chapter',
        detail: 'Chapter 1 has zero verses'
      });
      continue;
    }
    
    const v1 = verses[0].text;
    const fingerprint = FINGERPRINTS[book.name];
    
    if (fingerprint) {
      const regex = new RegExp(fingerprint);
      if (!regex.test(v1)) {
        // Try to identify what book this ACTUALLY is
        let actualBook = 'unknown';
        for (const [candidate, fp] of Object.entries(FINGERPRINTS)) {
          if (candidate === book.name) continue;
          if (new RegExp(fp).test(v1)) {
            actualBook = candidate;
            break;
          }
        }
        
        report.issues.push({
          book: book.name,
          book_id: book.id,
          severity: 'error',
          type: 'wrong_content',
          detail: `ch1v1 doesn't match ${book.name} fingerprint "${fingerprint}"`,
          appears_to_be: actualBook,
          actual_text_preview: v1.substring(0, 150)
        });
      }
    }
  }

  // 2. Pauline corpus chapter-by-chapter scan
  console.error('=== Phase 2: Pauline chapter-by-chapter scan ===');
  const pauline = books.filter(b => PAULINE_SHIFT_RISK.includes(b.name));
  
  for (const book of pauline) {
    for (let ch = 1; ch <= Math.min(book.chapters, 8); ch++) {
      const rows = await sql`
        SELECT content FROM formatted_chapter_contents
        WHERE book_id = ${book.id} AND chapter_number = ${ch} LIMIT 1
      `;
      if (rows.length === 0) continue;
      
      const verses = extractVerses(rows[0].content);
      if (verses.length === 0) continue;
      
      const v1 = verses[0].text;
      const fp = FINGERPRINTS[book.name];
      
      if (fp && !new RegExp(fp).test(v1)) {
        // Identify actual content
        let actual = 'unknown';
        for (const [candidate, candidateFp] of Object.entries(FINGERPRINTS)) {
          if (candidate === book.name) continue;
          if (new RegExp(candidateFp).test(v1)) {
            actual = candidate;
            break;
          }
        }
        // If no fingerprint match, check adjacent Pauline books
        if (actual === 'unknown') {
          const idx = PAULINE_SHIFT_RISK.indexOf(book.name);
          if (idx > 0) {
            const prevFp = FINGERPRINTS[PAULINE_SHIFT_RISK[idx - 1]];
            if (prevFp && new RegExp(prevFp).test(v1)) {
              actual = PAULINE_SHIFT_RISK[idx - 1];
            }
          }
        }
        
        report.pauline_shift.push({
          db_book: book.name,
          db_book_id: book.id,
          chapter: ch,
          appears_to_be: actual,
          preview: v1.substring(0, 100)
        });
      }
    }
  }

  // 3. Summary
  report.summary = {
    ch1v1_mismatches: report.issues.filter(i => i.type === 'wrong_content').length,
    missing_chapters: report.issues.filter(i => i.type === 'missing_chapter').length,
    empty_chapters: report.issues.filter(i => i.type === 'empty_chapter').length,
    pauline_shifted_chapters: report.pauline_shift.length,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
