import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  for (const ch of [1, 2, 3]) {
    console.log(`\n========== Genesis ${ch} ==========`);
    // Current DB (AI-generated from old backup)
    const r = await sql`SELECT formatting_rules FROM formatted_chapter_contents fcc JOIN books b ON b.id = fcc.book_id WHERE b.name='Genesis' AND fcc.chapter_number=${ch}`;
    const fr = (r[0] as any).formatting_rules;
    console.log('CURRENT DB (AI-generated, from old format-analyzer):');
    for (const s of (fr?.sections || [])) {
      if (s.title) console.log(`  "${s.title}" — verses ${s.verseRange?.[0]}-${s.verseRange?.[1]}`);
    }
  }
  console.log('\n\n========== NEW extraction (page 10 only, covers Gen 1-3) ==========');
  const d = JSON.parse(fs.readFileSync('extraction_output/structure_page_10.json', 'utf-8'));
  for (const c of d.chapters) {
    console.log(`\n  Genesis ${c.chapter}:`);
    for (const s of c.subtitles) console.log(`    "${s.text}" before v${s.before_verse}`);
    if (c.paragraph_breaks.length) console.log(`    paragraph breaks after: v${c.paragraph_breaks.join(', v')}`);
    for (const r of c.poetry_ranges) console.log(`    poetry: v${r[0]}-v${r[1]}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
