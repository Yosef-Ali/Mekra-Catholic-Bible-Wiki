/**
 * Scan all chapters in the DB for verses whose text begins with a Ge'ez numeral
 * (U+1369–U+137C: ፩ ፪ ፫ … ፼). These are leftover verse markers that the
 * extractor failed to strip — they render as "1 ፩", "2 ፪" duplication in the UI.
 *
 * Usage:
 *   pnpm tsx scripts/check-geez-numerals.ts            # report only
 *   pnpm tsx scripts/check-geez-numerals.ts --json     # JSON output for piping
 */
import 'dotenv/config';
import { sql } from '../services/db';
import { leadingNumeralValue } from './lib/geez-numerals';

interface Hit {
  book: string;
  chapter: number;
  verse: number;
  preview: string;
}

async function main() {
  const jsonOut = process.argv.includes('--json');

  const rows = await sql`
    SELECT fcc.book_id, fcc.chapter_number, b.name AS book_name, fcc.content
    FROM formatted_chapter_contents fcc
    JOIN books b ON b.id = fcc.book_id
    ORDER BY b.id, fcc.chapter_number
  `;

  const hits: Hit[] = [];
  let scannedChapters = 0;
  let scannedVerses = 0;

  for (const row of rows) {
    scannedChapters++;
    const sections = (row.content as any)?.sections || [];
    for (const section of sections) {
      const verses = section?.verses || [];
      for (const v of verses) {
        scannedVerses++;
        const text = String(v?.text ?? '');
        const lead = leadingNumeralValue(text);
        if (lead !== null && lead === Number(v.verse_number)) {
          hits.push({
            book: row.book_name,
            chapter: row.chapter_number,
            verse: v.verse_number,
            preview: text.slice(0, 60),
          });
        }
      }
    }
  }

  if (jsonOut) {
    console.log(JSON.stringify({ scannedChapters, scannedVerses, hits }, null, 2));
    return;
  }

  console.log(`Scanned: ${scannedChapters} chapters, ${scannedVerses} verses`);
  console.log(`Hits:    ${hits.length} verses with leading Ge'ez numerals\n`);

  if (hits.length === 0) {
    console.log('✅ Clean — no duplicated Ge\'ez numerals found.');
    return;
  }

  // Group by book+chapter for readability
  const byChapter = new Map<string, Hit[]>();
  for (const h of hits) {
    const key = `${h.book} ${h.chapter}`;
    if (!byChapter.has(key)) byChapter.set(key, []);
    byChapter.get(key)!.push(h);
  }

  for (const [key, list] of byChapter) {
    console.log(`⚠️  ${key}  (${list.length} verses)`);
    for (const h of list.slice(0, 3)) {
      console.log(`     v${h.verse}: ${h.preview}`);
    }
    if (list.length > 3) console.log(`     … +${list.length - 3} more`);
  }

  console.log(`\nAffected chapters: ${byChapter.size}`);
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
