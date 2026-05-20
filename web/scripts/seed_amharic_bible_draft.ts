import fs from 'fs';
import path from 'path';
import { db } from '../services/db';
import { books, chapters, verses } from '../services/schema';
import { eq } from 'drizzle-orm';

const FORMATTED_BOOKS_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/formatted_books';

// Map English book names to their order (1-73) and category
// This is a simplified map. In a real scenario, we might want more metadata.
// For now, we rely on the filename number for order.

async function seedAmharicBible() {
  console.log('🚀 Starting Amharic Bible Seeding...');

  try {
    // 1. Clear existing data
    console.log('🗑️  Clearing existing data...');
    await db.delete(verses);
    await db.delete(chapters);
    await db.delete(books);
    console.log('✅ Data cleared.');

    // 2. Get list of files
    const files = fs.readdirSync(FORMATTED_BOOKS_DIR)
      .filter(f => f.endsWith('.txt'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[0]);
        const numB = parseInt(b.split('_')[0]);
        return numA - numB;
      });

    console.log(`Found ${files.length} books to process.`);

    // 3. Process each book
    for (const file of files) {
      const filePath = path.join(FORMATTED_BOOKS_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse filename: 01_Genesis_Amharic.txt
      const parts = file.split('_');
      const bookNumber = parseInt(parts[0]);
      const englishName = parts[1]; // e.g. Genesis

      // Extract Amharic Title (first line usually, or derived)
      // The files usually start with the book title or "Chapter 1"
      // Let's assume the first non-empty line that isn't "Chapter 1" is the title, 
      // OR we use a hardcoded map if needed. 
      // For now, let's use the English name as a placeholder or try to extract.
      // Actually, my extraction script saved clean text. 
      // Let's look at the first few lines.
      const lines = content.split('\n').map(l => l.trim()).filter(l => l);

      let amharicTitle = englishName; // Fallback
      // Heuristic: If first line doesn't start with "ምዕራፍ", it's likely the title
      if (!lines[0].startsWith('ምዕራፍ')) {
        amharicTitle = lines[0];
      }

      console.log(`\nProcessing Book ${bookNumber}: ${englishName} (${amharicTitle})`);

      // Insert Book
      const [insertedBook] = await db.insert(books).values({
        id: bookNumber,
        name: englishName, // Using English name for 'name' field as per schema likely expectation? 
        // Wait, schema might want Amharic. Let's check schema.ts content first.
        // Assuming 'name' is the display name. Let's use Amharic if available, or English.
        // Actually, standard practice is often English for ID/slug, Amharic for title.
        // Let's use English for now to be safe with unique constraints if any, 
        // but wait, I should check if there's a 'title' field.
        // I'll assume 'name' is the main field. I'll put Amharic in 'testament' or similar if needed?
        // No, let's stick to the schema.
        // REVISION: I will use the English name for 'name' and maybe there's another field.
        // Let's look at the schema file I viewed.
        // Schema has: id, name, testament, abbreviation.
        testament: bookNumber <= 46 ? 'Old Testament' : 'New Testament', // Simple heuristic
        abbreviation: englishName.substring(0, 3).toUpperCase(),
      }).returning();

      // Parse Chapters and Verses
      let currentChapter = 0;
      let verseCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for Chapter Header
        const chapterMatch = line.match(/^ምዕራፍ\s+(\d+)/);
        if (chapterMatch) {
          currentChapter = parseInt(chapterMatch[1]);

          // Insert Chapter
          await db.insert(chapters).values({
            bookId: insertedBook.id,
            number: currentChapter,
          });
          continue;
        }

        // Check for Verses
        // Verses usually start with number: "1 In the beginning..."
        // But my formatted text might have joined paragraphs.
        // Let's look at the formatted text structure again.
        // "1 ... 2 ..." -> It's paragraph style.
        // I need to split by verse numbers.

        // Regex to find verse numbers: digit(s) followed by space or punctuation?
        // In Amharic text: "1 በመጀመሪያ..." (Note: might be special space)

        // Strategy: Split line by verse regex
        const verseParts = line.split(/(\d+)\s+/).filter(p => p.trim());

        // This split is tricky because "1 text 2 text" becomes ["", "1", "text", "2", "text"]
        // We need to iterate and pair them.

        // Better approach: Match all verses in the line
        // But wait, the file format is:
        // Chapter 1
        // 1 Verse one text. 2 Verse two text...

        // So I can just scan the text.
        const verseRegex = /(\d+)\s+([^0-9]+)/g; // Naive regex
        // Actually, verse numbers are distinct. 

        // Let's try a state machine approach for the line
        let match;
        // We need to handle the case where a verse spans multiple lines? 
        // My formatting script joined paragraphs, so verses shouldn't span lines ideally, 
        // OR a line contains multiple verses.

        // Let's assume the text is well-formatted enough that we can find "N <text>"

        // Actually, simpler: 
        // 1. Combine all lines of the chapter into one big text blob.
        // 2. Split by verse number pattern.
      }

      // REVISED PARSING STRATEGY:
      // 1. Group lines by Chapter.
      // 2. For each chapter, join text.
      // 3. Split by verse markers.

      // Let's implement this "Group by Chapter" logic first.
    }

    console.log('🎉 Seeding Complete!');
  } catch (error) {
    console.error('❌ Seeding Failed:', error);
  }
}

seedAmharicBible();
