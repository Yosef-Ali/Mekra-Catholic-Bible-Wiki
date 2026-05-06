#!/usr/bin/env node
/**
 * fix-pauline-contamination.mjs
 *
 * Fixes the Pauline corpus book_id contamination in formatted_chapter_contents.
 *
 * ISSUE: During the Gemini PDF extraction → seed pipeline, chapters were
 * assigned to wrong book_ids:
 *   - Romans ch1-9   = 1 Corinthians content (real Romans 1-9 is MISSING)
 *   - 1 Cor  ch1-16  = 2 Corinthians content (real 1 Cor is MISSING)
 *   - 2 Cor  ch1-13  = 2 Corinthians content (correct, but duplicated from 1 Cor)
 *
 * FIX STRATEGY (best-effort with available data):
 *   1. Move Romans ch1-9 to 1 Cor — these ARE 1 Cor chapters
 *   2. Move 1 Cor ch1-13 to 2 Cor, overwriting duplicates
 *   3. Mark 1 Cor ch14-16 as missing (2 Cor has only 13 chapters)
 *
 * POST-FIX STATE:
 *   - Romans: ch1-9 MISSING, ch10-16 = real Romans
 *   - 1 Cor:  ch1-9 recovered from Romans' slot, ch10-16 MISSING
 *   - 2 Cor:  ch1-13 = real 2 Cor (no more duplicates)
 *
 * Reads DATABASE_URL from the Mekra app .env.
 *
 * Usage: node scripts/fix-pauline-contamination.mjs [--dry-run]
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'node:fs';

const APP_ENV = '/Users/mekdesyared/Mekra-Catholic-Bible/.env';
if (!process.env.DATABASE_URL && existsSync(APP_ENV)) {
  for (const line of readFileSync(APP_ENV, 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) process.env.DATABASE_URL = m[1].replace(/^["']|["']$/g, '');
  }
}
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found');
  process.exit(2);
}

const sql = neon(process.env.DATABASE_URL);
const dryRun = process.argv.includes('--dry-run');

// Book IDs from the DB
const ROMANS_ID = 198;
const COR1_ID = 199;
const COR2_ID = 200;

async function main() {
  console.log(dryRun ? '🔍 DRY RUN — no changes will be made\n' : '⚠️  LIVE RUN — changes WILL be committed\n');

  // 1. Count affected rows
  const romansCorrupted = await sql`
    SELECT COUNT(*) as c FROM formatted_chapter_contents
    WHERE book_id = ${ROMANS_ID} AND chapter_number BETWEEN 1 AND 9
  `;
  const cor1All = await sql`
    SELECT COUNT(*) as c FROM formatted_chapter_contents
    WHERE book_id = ${COR1_ID}
  `;
  const cor2All = await sql`
    SELECT COUNT(*) as c FROM formatted_chapter_contents
    WHERE book_id = ${COR2_ID}
  `;

  console.log('=== Current State ===');
  console.log(`Romans ch1-9 (corrupted):  ${romansCorrupted[0].c} chapters`);
  console.log(`1 Cor (all = 2 Cor dup):   ${cor1All[0].c} chapters`);
  console.log(`2 Cor (correct but duped): ${cor2All[0].c} chapters`);

  // 2. Move Romans ch1-9 → 1 Cor (these ARE 1 Cor chapters)
  console.log('\n=== Fix 1: Move Romans ch1-9 → 1 Corinthians ===');
  for (let ch = 1; ch <= 9; ch++) {
    const existing = await sql`
      SELECT id FROM formatted_chapter_contents 
      WHERE book_id = ${COR1_ID} AND chapter_number = ${ch}
    `;
    if (existing.length > 0) {
      console.log(`  1 Cor ${ch}: already exists, deleting before move`);
      if (!dryRun) await sql`DELETE FROM formatted_chapter_contents WHERE book_id = ${COR1_ID} AND chapter_number = ${ch}`;
    }
    if (!dryRun) {
      await sql`
        UPDATE formatted_chapter_contents 
        SET book_id = ${COR1_ID}
        WHERE book_id = ${ROMANS_ID} AND chapter_number = ${ch}
      `;
    }
    console.log(`  Romans ${ch} → 1 Cor ${ch} ${dryRun ? '[DRY RUN]' : '✅'}`);
  }

  // 3. Move 1 Cor ch1-13 → 2 Cor (these ARE 2 Cor chapters), delete ch14-16
  console.log('\n=== Fix 2: Move 1 Cor ch1-13 → 2 Corinthians ===');
  for (let ch = 1; ch <= 13; ch++) {
    const existing = await sql`
      SELECT id FROM formatted_chapter_contents
      WHERE book_id = ${COR2_ID} AND chapter_number = ${ch}
    `;
    if (existing.length > 0) {
      console.log(`  2 Cor ${ch}: already exists, deleting duplicate`);
      if (!dryRun) await sql`DELETE FROM formatted_chapter_contents WHERE book_id = ${COR2_ID} AND chapter_number = ${ch}`;
    }
    if (!dryRun) {
      await sql`
        UPDATE formatted_chapter_contents
        SET book_id = ${COR2_ID}
        WHERE book_id = ${COR1_ID} AND chapter_number = ${ch}
      `;
    }
    console.log(`  1 Cor ${ch} → 2 Cor ${ch} ${dryRun ? '[DRY RUN]' : '✅'}`);
  }

  // 4. Delete 1 Cor ch14-16 (2 Cor has only 13 chapters; these are trash)
  console.log('\n=== Fix 3: Remove 1 Cor ch14-16 (no real source) ===');
  for (let ch = 14; ch <= 16; ch++) {
    if (!dryRun) {
      await sql`DELETE FROM formatted_chapter_contents WHERE book_id = ${COR1_ID} AND chapter_number = ${ch}`;
    }
    console.log(`  1 Cor ${ch}: deleted ${dryRun ? '[DRY RUN]' : '✅'}`);
  }

  // 5. Verify
  console.log('\n=== Post-Fix Verification ===');
  const vRomans = await sql`
    SELECT chapter_number FROM formatted_chapter_contents
    WHERE book_id = ${ROMANS_ID} ORDER BY chapter_number
  `;
  const vCor1 = await sql`
    SELECT chapter_number FROM formatted_chapter_contents
    WHERE book_id = ${COR1_ID} ORDER BY chapter_number
  `;
  const vCor2 = await sql`
    SELECT chapter_number FROM formatted_chapter_contents
    WHERE book_id = ${COR2_ID} ORDER BY chapter_number
  `;

  console.log(`Romans chapters:  [${vRomans.map(r => r.chapter_number).join(', ')}] (missing: 1-9)`);
  console.log(`1 Cor chapters:   [${vCor1.map(r => r.chapter_number).join(', ')}] (missing: 10-16)`);
  console.log(`2 Cor chapters:   [${vCor2.map(r => r.chapter_number).join(', ')}] (expected: 1-13)`);

  // 6. Sample Romans 6 to confirm fix
  const r6 = await sql`
    SELECT LEFT(content::text, 150) as preview FROM formatted_chapter_contents
    WHERE book_id = ${ROMANS_ID} AND chapter_number = 6 LIMIT 1
  `;
  if (r6.length > 0) {
    console.log(`\nRomans 6 preview: ${r6[0].preview.substring(0, 80)}...`);
  } else {
    console.log('\nRomans 6: MISSING (needs re-extraction)');
  }

  console.log('\n=== Summary ===');
  console.log('Romans 1-9 and 1 Corinthians 10-16 are STILL MISSING.');
  console.log('They require Gemini re-extraction from the Emmaus PDF.');
  console.log('Run: node scripts/validate_db_mappings.mjs to re-check all books.');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
