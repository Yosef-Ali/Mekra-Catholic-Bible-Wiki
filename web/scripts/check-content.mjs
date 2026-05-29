import { neon } from '@neondatabase/serverless';

const sql = neon('postgresql://neondb_owner:npg_OpI80oWNlxQS@ep-spring-violet-ahv1tp3h-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function check() {
  const result = await sql`SELECT content FROM chapter_contents WHERE book_id = 1 AND chapter_number = 1`;
  const content = result[0]?.content || '';
  console.log('Content length:', content.length);
  console.log('Last 300 chars:', content.slice(-300));
  console.log('Has ... at end:', content.endsWith('...'));
}

check().catch(console.error);
