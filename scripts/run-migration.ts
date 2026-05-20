import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

config();

const sql = neon(process.env.DATABASE_URL!);

async function runMigration() {
  console.log('🔧 Running migration: add_formatting_rules...\n');

  try {
    // Add formatting_rules column
    await sql`
      ALTER TABLE formatted_chapter_contents
      ADD COLUMN IF NOT EXISTS formatting_rules JSONB
    `;

    // Add index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_chapter_formatting
      ON formatted_chapter_contents(book_id, chapter_number)
    `;

    console.log('✅ Migration completed successfully!');
    console.log('   - Added formatting_rules column');
    console.log('   - Created index on (book_id, chapter_number)');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
