import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function run() {
  const books = await sql`SELECT * FROM books LIMIT 5`;
  console.log("Books:", books);

  const samples = await sql`
    SELECT b.name, c.chapter_number, c.content
    FROM formatted_chapter_contents c
    JOIN books b ON c.book_id = b.id
    LIMIT 1
  `;
  
  if (samples.length > 0) {
    console.log(JSON.stringify(samples[0].content, null, 2));
  } else {
    console.log("No formatted_chapter_contents found.");
  }
}

run();
