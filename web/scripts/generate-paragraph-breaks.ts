/**
 * Generate paragraphBreaks for all chapters from existing content.sections.
 * No Gemini API needed — derives breaks directly from section boundaries.
 *
 * Logic: the first verse of each section = a paragraph break point.
 *
 * Usage: npx tsx scripts/generate-paragraph-breaks.ts
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('📐 Generating paragraph breaks from content sections...\n');

  // Fetch all chapters with their content and formattingRules
  const chapters = await sql`
    SELECT
      fcc.id,
      fcc.book_id,
      fcc.chapter_number,
      fcc.content,
      fcc.formatting_rules,
      b.name as book_name
    FROM formatted_chapter_contents fcc
    JOIN books b ON b.id = fcc.book_id
    ORDER BY fcc.book_id, fcc.chapter_number
  `;

  console.log(`Found ${chapters.length} chapters to process.\n`);

  let updated = 0;
  let skipped = 0;
  let noSections = 0;

  for (const ch of chapters) {
    const content = ch.content as any;
    const sections: any[] = content?.sections || [];

    if (sections.length === 0) {
      noSections++;
      continue;
    }

    // Derive paragraph breaks: first verse of each section
    const paragraphBreaks: number[] = [];
    for (const section of sections) {
      const verses: any[] = section.verses || [];
      if (verses.length > 0) {
        const firstVerse = verses[0].verse_number;
        if (firstVerse > 0 && !paragraphBreaks.includes(firstVerse)) {
          paragraphBreaks.push(firstVerse);
        }
      }
    }
    paragraphBreaks.sort((a, b) => a - b);

    if (paragraphBreaks.length === 0) {
      skipped++;
      continue;
    }

    // Preserve existing formattingRules, only update paragraphBreaks
    const existingRules = (ch.formatting_rules as any) || {};
    const updatedRules = {
      ...existingRules,
      paragraphBreaks,
    };

    await sql`
      UPDATE formatted_chapter_contents
      SET formatting_rules = ${JSON.stringify(updatedRules)}::jsonb
      WHERE id = ${ch.id}
    `;

    updated++;

    if (updated % 100 === 0) {
      console.log(`  ✅ ${updated}/${chapters.length} chapters updated...`);
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Updated:     ${updated} chapters`);
  console.log(`   Skipped:     ${skipped} (no verses found)`);
  console.log(`   No sections: ${noSections} (need content fix first)`);
  console.log(`\nRun 'pnpm quality:check' to verify all chapters now have paragraphBreaks.`);
}

main().catch(console.error);
