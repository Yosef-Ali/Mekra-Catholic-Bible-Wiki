import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const c = await sql`SELECT COUNT(*) as n FROM formatted_chapter_contents`;
  console.log('rows in DB:', c);
  const r = await sql`SELECT b.name, fcc.chapter_number FROM formatted_chapter_contents fcc JOIN books b ON b.id=fcc.book_id WHERE b.name='Revelation' AND fcc.chapter_number > 22 ORDER BY fcc.chapter_number LIMIT 5`;
  console.log('fake Rev rows:', r);
}
main().catch(e => { console.error(e); process.exit(1); });
