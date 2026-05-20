import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const r = await sql`SELECT fcc.content FROM formatted_chapter_contents fcc JOIN books b ON b.id = fcc.book_id WHERE b.name = 'Genesis' AND fcc.chapter_number = 9`;
  const v = (r[0].content as any).sections[0].verses[0];
  console.log('verse_number:', v.verse_number, typeof v.verse_number);
  console.log('text:', JSON.stringify(v.text));
  console.log('first char codepoint:', v.text.charCodeAt(0).toString(16));
}
main().catch(e => { console.error(e); process.exit(1); });
