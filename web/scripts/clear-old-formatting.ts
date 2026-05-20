/**
 * Clear AI-generated formatting_rules from all chapters.
 * Verse text is untouched. Subtitles will disappear from the UI until
 * the new structural extraction is merged in.
 */
import 'dotenv/config';
import { sql } from '../services/db';

async function main() {
  const before = await sql`SELECT COUNT(*)::int AS n FROM formatted_chapter_contents WHERE formatting_rules IS NOT NULL`;
  console.log(`Rows with formatting_rules before: ${(before[0] as any).n}`);

  const r = await sql`UPDATE formatted_chapter_contents SET formatting_rules = NULL, updated_at = NOW() WHERE formatting_rules IS NOT NULL`;
  console.log('Cleared.');

  const after = await sql`SELECT COUNT(*)::int AS n FROM formatted_chapter_contents WHERE formatting_rules IS NOT NULL`;
  console.log(`Rows with formatting_rules after:  ${(after[0] as any).n}`);
}

main().catch(e => { console.error('❌ Failed:', e); process.exit(1); });
