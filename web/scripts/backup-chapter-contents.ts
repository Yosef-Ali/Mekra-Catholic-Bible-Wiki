/**
 * Dump formatted_chapter_contents to a timestamped JSON file.
 * Restore-able with restore-chapter-contents.ts.
 */
import 'dotenv/config';
import { sql } from '../services/db';
import fs from 'fs';
import path from 'path';

async function main() {
  const rows = await sql`
    SELECT id, book_id, chapter_number, content, style, formatting_rules,
           verified, created_at, updated_at
    FROM formatted_chapter_contents
    ORDER BY id
  `;

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `formatted_chapter_contents_${ts}.json`);

  fs.writeFileSync(file, JSON.stringify({
    table: 'formatted_chapter_contents',
    backed_up_at: new Date().toISOString(),
    row_count: rows.length,
    rows,
  }, null, 2));

  const sizeMb = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
  console.log(`✅ Backup written: ${file}`);
  console.log(`   Rows: ${rows.length}`);
  console.log(`   Size: ${sizeMb} MB`);
}

main().catch(err => { console.error('❌ Backup failed:', err); process.exit(1); });
