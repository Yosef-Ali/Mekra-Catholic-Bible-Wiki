import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const r = await sql`SELECT current_database() as db, current_user as user`;
  console.log('connected:', r);
  const t = await sql`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name`;
  console.log('tables:', t);
}
main().catch(e => { console.error(e); process.exit(1); });
