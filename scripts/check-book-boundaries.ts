/**
 * Check content at book boundaries to understand the data mix-up pattern.
 * Specifically: last chapter of book N, first chapter of book N+1
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Books known to have issues + their neighbors
  const bookPairs = [
    ['Lamentations', 'Baruch'],
    ['Obadiah', 'Jonah'],
    ['Philemon', 'Hebrews'],
    ['Jude', 'Revelation'],
  ];

  for (const [bookA, bookB] of bookPairs) {
    const rows = await sql`
      SELECT fcc.book_id, fcc.chapter_number, b.name as book_name, b.chapters as total_chapters,
        fcc.content
      FROM formatted_chapter_contents fcc
      JOIN books b ON b.id = fcc.book_id
      WHERE b.name IN (${bookA}, ${bookB})
      ORDER BY b.id, fcc.chapter_number
    `;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Checking: ${bookA} ↔ ${bookB}`);

    for (const row of rows) {
      const c = row.content as any;
      const sections = c?.sections || [];
      const totalVerses = sections.reduce((sum: number, s: any) => sum + (s.verses?.length || 0), 0);
      const firstVerse = sections[0]?.verses?.[0];

      // Only show first and last chapters
      if (row.chapter_number !== 1 && row.chapter_number !== (row.total_chapters as number)) continue;

      console.log(`\n  ${row.book_name} Ch ${row.chapter_number}/${row.total_chapters}: ${totalVerses} verses`);
      if (firstVerse) {
        console.log(`    First: [${firstVerse.verse_number}] ${String(firstVerse.text).substring(0, 100)}`);
      } else {
        console.log(`    ⚠️  No verses!`);
      }
    }
  }

  // Also check Proverbs 17/18 boundary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Checking: Proverbs Ch 17-18`);
  const prov = await sql`
    SELECT fcc.chapter_number, fcc.content
    FROM formatted_chapter_contents fcc
    JOIN books b ON b.id = fcc.book_id
    WHERE b.name = 'Proverbs' AND fcc.chapter_number IN (17, 18, 19)
    ORDER BY fcc.chapter_number
  `;
  for (const row of prov) {
    const c = row.content as any;
    const sections = c?.sections || [];
    const totalVerses = sections.reduce((sum: number, s: any) => sum + (s.verses?.length || 0), 0);
    const firstVerse = sections[0]?.verses?.[0];
    const lastSection = sections[sections.length - 1];
    const lastVerse = lastSection?.verses?.[lastSection.verses.length - 1];
    console.log(`\n  Proverbs Ch ${row.chapter_number}: ${totalVerses} verses`);
    if (firstVerse) console.log(`    First: [${firstVerse.verse_number}] ${String(firstVerse.text).substring(0, 100)}`);
    if (lastVerse) console.log(`    Last:  [${lastVerse.verse_number}] ${String(lastVerse.text).substring(0, 100)}`);
  }
}

main().catch(console.error);
