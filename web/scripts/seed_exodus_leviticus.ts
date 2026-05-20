import fs from 'fs';
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq } from 'drizzle-orm';

interface ExtractedVerse {
  verse_number: number;
  text: string;
}

interface ExtractedSection {
  title: string;
  verses: ExtractedVerse[];
}

interface ExtractedChapter {
  chapter_number: number;
  sections: ExtractedSection[];
}

interface ExtractedBook {
  book_name: string;
  book_name_amharic?: string;
  total_chapters: number;
  chapters: ExtractedChapter[];
}

interface ExtractionFile {
  book: ExtractedBook;
}

async function seedBook(bookId: number, jsonPath: string) {
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ File not found: ${jsonPath}`);
    return false;
  }

  console.log(`\n📖 Processing: ${jsonPath}`);

  // Read JSON
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  let data: ExtractedBook;

  try {
    const parsed: ExtractionFile = JSON.parse(jsonContent);
    data = parsed.book;
  } catch (e) {
    console.error(`❌ Failed to parse JSON: ${e}`);
    return false;
  }

  console.log(`   Book: ${data.book_name} (${data.book_name_amharic || 'N/A'})`);
  console.log(`   Chapters in file: ${data.chapters.length}`);

  // Get book record
  const [bookRecord] = await db.select().from(books).where(eq(books.id, bookId));
  if (!bookRecord) {
    console.error(`❌ Book ID ${bookId} not found in database`);
    return false;
  }

  console.log(`   DB Book: ${bookRecord.name} (${bookRecord.amharicName})`);
  console.log(`   DB Chapters: ${bookRecord.chapters}`);

  // Update chapter count if needed
  if (bookRecord.chapters !== data.chapters.length) {
    console.log(`   ⚠️ Updating chapter count: ${bookRecord.chapters} → ${data.chapters.length}`);
    await db.update(books)
      .set({ chapters: data.chapters.length })
      .where(eq(books.id, bookId));
  }

  // Clear existing chapters for this book
  await db.delete(chapterContents).where(eq(chapterContents.bookId, bookId));
  console.log(`   🗑️ Cleared existing chapters`);

  // Insert chapters
  let successCount = 0;
  for (const chapter of data.chapters) {
    try {
      // Transform to expected format
      const content = {
        sections: chapter.sections.map(s => ({
          title: s.title || '',
          verses: s.verses.map(v => ({
            verse_number: v.verse_number,
            text: v.text
          }))
        }))
      };

      await db.insert(chapterContents).values({
        bookId: bookId,
        chapterNumber: chapter.chapter_number,
        content: content as any,
        style: 'prose',
        verified: 1,
      });

      successCount++;
      process.stdout.write(`\r   ✅ Inserted: ${successCount}/${data.chapters.length} chapters`);
    } catch (e) {
      console.error(`\n   ❌ Failed to insert chapter ${chapter.chapter_number}: ${e}`);
    }
  }

  console.log(`\n   🎉 Completed: ${successCount}/${data.chapters.length} chapters`);
  return successCount === data.chapters.length;
}

async function main() {
  console.log('='.repeat(60));
  console.log('📚 SEEDING EXODUS AND LEVITICUS');
  console.log('='.repeat(60));

  const tasks = [
    { bookId: 2, path: './extraction_output/Exodus_extracted.json' },
    { bookId: 3, path: './extraction_output/Leviticus_extracted.json' },
  ];

  const results: { name: string; success: boolean }[] = [];

  for (const task of tasks) {
    const success = await seedBook(task.bookId, task.path);
    results.push({ name: task.path, success: success || false });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS');
  console.log('='.repeat(60));
  results.forEach(r => {
    console.log(`   ${r.success ? '✅' : '❌'} ${r.name}`);
  });
  console.log('='.repeat(60));
}

main().catch(console.error);
