/**
 * Restore formatting_rules + style from the pre-reseed backup, while keeping
 * the cleaned verse text in the current DB. Matches rows by (book_id, chapter_number).
 *
 * Usage:
 *   pnpm tsx scripts/merge-formatting-from-backup.ts <backup.json>           # dry run
 *   pnpm tsx scripts/merge-formatting-from-backup.ts <backup.json> --live    # apply
 */
import 'dotenv/config';
import fs from 'fs';
import { sql } from '../services/db';

interface BackupRow {
  id: number;
  book_id: number;
  chapter_number: number;
  content: any;
  style: string | null;
  formatting_rules: any;
}

async function main() {
  const args = process.argv.slice(2);
  const backupPath = args.find(a => !a.startsWith('--'));
  const live = args.includes('--live');

  if (!backupPath) {
    console.error('Usage: pnpm tsx scripts/merge-formatting-from-backup.ts <backup.json> [--live]');
    process.exit(1);
  }

  console.log(`Mode: ${live ? '🚨 LIVE' : 'DRY RUN'}`);
  console.log(`Backup: ${backupPath}\n`);

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  const backupRows: BackupRow[] = backup.rows;

  // Index backup by (book_id, chapter_number)
  const backupByKey = new Map<string, BackupRow>();
  for (const r of backupRows) {
    backupByKey.set(`${r.book_id}:${r.chapter_number}`, r);
  }
  console.log(`Backup rows: ${backupRows.length}`);

  // Pull current DB rows
  const currentRows = await sql`
    SELECT id, book_id, chapter_number, formatting_rules, style
    FROM formatted_chapter_contents
  ` as Array<{ id: number; book_id: number; chapter_number: number; formatting_rules: any; style: string | null }>;
  console.log(`Current rows: ${currentRows.length}`);

  let willUpdate = 0;
  let noBackupMatch = 0;
  let backupHadNoFormatting = 0;

  const updates: Array<{ id: number; formatting_rules: any; style: string | null }> = [];

  for (const cur of currentRows) {
    const key = `${cur.book_id}:${cur.chapter_number}`;
    const bk = backupByKey.get(key);
    if (!bk) { noBackupMatch++; continue; }
    if (!bk.formatting_rules) { backupHadNoFormatting++; continue; }
    updates.push({
      id: cur.id,
      formatting_rules: bk.formatting_rules,
      style: bk.style ?? cur.style,
    });
    willUpdate++;
  }

  console.log(`\nWill update:           ${willUpdate}`);
  console.log(`No backup match:       ${noBackupMatch}`);
  console.log(`Backup had no rules:   ${backupHadNoFormatting}`);

  // Sample
  if (updates.length > 0) {
    const sample = updates[0];
    const fr = sample.formatting_rules;
    const titles = fr?.sections?.map((s: any) => s.title).filter(Boolean).slice(0, 4);
    console.log(`\nSample update — id ${sample.id}, style=${sample.style}, first titles: ${JSON.stringify(titles)}`);
  }

  if (!live) {
    console.log('\n✅ DRY RUN complete. Re-run with --live to apply.');
    return;
  }

  console.log('\n🚨 Applying updates...');
  const ids = updates.map(u => u.id);
  const rules = updates.map(u => JSON.stringify(u.formatting_rules));
  const styles = updates.map(u => u.style);
  await sql`
    UPDATE formatted_chapter_contents AS fcc
    SET formatting_rules = u.fr::jsonb,
        style = u.style,
        updated_at = NOW()
    FROM UNNEST(${ids}::int[], ${rules}::text[], ${styles}::text[]) AS u(id, fr, style)
    WHERE fcc.id = u.id
  `;
  console.log(`\n✅ Updated ${updates.length} rows.`);
}

main().catch(err => { console.error('❌ Failed:', err); process.exit(1); });
