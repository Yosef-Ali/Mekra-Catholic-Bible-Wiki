import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const rows = await sql`
    SELECT fcc.book_id, fcc.chapter_number, b.name as book_name,
      fcc.content, fcc.formatting_rules
    FROM formatted_chapter_contents fcc
    JOIN books b ON b.id = fcc.book_id
    WHERE (b.name = 'Job' AND fcc.chapter_number = 2)
       OR (b.name = 'Lamentations' AND fcc.chapter_number = 1)
       OR (b.name = 'Baruch' AND fcc.chapter_number = 1)
       OR (b.name = 'Proverbs' AND fcc.chapter_number = 18)
       OR (b.name = 'Philemon' AND fcc.chapter_number = 1)
       OR (b.name = 'Jude' AND fcc.chapter_number = 1)
       OR (b.name = 'Obadiah' AND fcc.chapter_number = 1)
    ORDER BY b.name, fcc.chapter_number
  `;

  for (const row of rows) {
    const c = row.content as any;
    const sections = c?.sections || [];
    const totalVerses = sections.reduce((sum: number, s: any) => sum + (s.verses?.length || 0), 0);
    console.log(`\n=== ${row.book_name} Ch ${row.chapter_number} ===`);
    console.log(`Total verses: ${totalVerses}, Sections: ${sections.length}`);
    sections.forEach((s: any, i: number) => {
      const verses = s.verses || [];
      console.log(`  Section ${i+1}: type=${s.type}, verses=${verses.length}`);
      if (verses.length > 0) {
        const first = verses[0];
        const last = verses[verses.length - 1];
        console.log(`    First: [${first.verse_number}] ${String(first.text).substring(0, 80)}`);
        if (verses.length > 1) console.log(`    Last:  [${last.verse_number}] ${String(last.text).substring(0, 80)}`);
      }
    });
  }
}

main().catch(console.error);
