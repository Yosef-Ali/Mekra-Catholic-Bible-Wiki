import { db } from '../services/db';
import { books, chapterContents } from '../services/schema'; // Note: chapterContents now maps to 'formatted_chapter_contents'
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { ExtractionResult } from '../services/extraction_schema';

// Removed hardcoded path, using dynamic below

const targetFile = process.argv[2] || 'Genesis_extracted.json';
const JSON_PATH = path.join(process.cwd(), 'extraction_output', targetFile);

async function seedFormattedBook() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`❌ File not found: ${JSON_PATH}`);
    return;
  }

  console.log('📖 Reading extracted JSON...');
  const jsonContent = fs.readFileSync(JSON_PATH, 'utf-8');
  let data: ExtractionResult['book'];

  try {
    // Handle potential markdown wrapping from Gemini if it wasn't stripped
    const cleanJson = jsonContent.replace(/```json/g, '').replace(/```/g, '');
    const parsed = JSON.parse(cleanJson);
    // Support both wrapped "book" object or direct object
    data = parsed.book || parsed;
  } catch (e) {
    console.error('❌ JSON Parse Error:', e);
    return;
  }

  console.log(`Processing Book: ${data.book_name} (${data.chapters.length} chapters found)`);

  // 1. Get Book ID
  // Assuming 'Genesis' or 'ኦሪት ዘፍጥረት' maps to book ID 1
  const bookRecord = await db.query.books.findFirst({
    where: (books, { eq, or }) => or(eq(books.name, data.book_name), eq(books.amharicName, (data as any).book_name_amharic || ''))
  });

  if (!bookRecord) {
    console.error(`❌ Book "${data.book_name}" not found in DB. Run basic seeding first.`);
    return;
  }

  console.log(`✅ Linked to DB Book: ${bookRecord.name} (ID: ${bookRecord.id})`);

  // 2. Clear existing formatted content for this book
  await db.delete(chapterContents).where(eq(chapterContents.bookId, bookRecord.id));
  console.log('🗑️  Cleared old formatting data.');

  // 3. Insert Chapters
  for (const chapter of data.chapters) {
    await db.insert(chapterContents).values({
      bookId: bookRecord.id,
      chapterNumber: chapter.chapter_number,
      content: chapter.content as any, // Cast to jsonb
      style: 'prose', // Default, but content has mixed
      verified: 1, // Auto-verified by pipeline
    });
    console.log(`__ Inserted Chapter ${chapter.chapter_number}`);
  }

  console.log('🎉 Seeding Complete!');
}

seedFormattedBook();
