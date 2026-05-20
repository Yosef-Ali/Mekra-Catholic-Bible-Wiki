import fs from 'fs';
import path from 'path';
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and } from 'drizzle-orm';

interface ExtractionItem {
  type: 'book_title' | 'introduction_title' | 'introduction_text' | 'chapter_header' | 'section_header' | 'verse' | 'poetry';
  number?: number;
  text?: string;
  lines?: string[];
}

interface ExtractionResult {
  items: ExtractionItem[];
}

const PROCESSED_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/processed_vision';

// Mapping of PDF book titles to database book names (handles variations)
const BOOK_NAME_VARIANTS: Record<string, string> = {
  'ቶብት': 'ጦቢት',   // Tobit variant
  'ዳግም': 'ዘዳግም',  // Deuteronomy variant
  'ፍጥረት': 'ዘፍጥረት', // Genesis variant
  'ፀአት': 'ዘፀአት',   // Exodus variant
  'ዘሌዋ': 'ዘሌዋውያን', // Leviticus variant
  'ኍልቊ': 'ዘኍልቊ',  // Numbers variant
};

async function findBookId(titleText: string): Promise<{ id: number; name: string } | null> {
  const allBooks = await db.select().from(books);

  // Clean up title (remove numbers, chapter indicators, etc.)
  let cleanTitle = titleText.replace(/[0-9-]/g, '').trim();
  cleanTitle = cleanTitle.replace(/ምዕራፍ/g, '').trim();

  // First try direct match
  let match = allBooks.find(b =>
    cleanTitle.includes(b.amharicName) || b.amharicName.includes(cleanTitle)
  );

  if (match) {
    return { id: match.id, name: match.name };
  }

  // Try with variants
  for (const [variant, canonical] of Object.entries(BOOK_NAME_VARIANTS)) {
    if (cleanTitle.includes(variant)) {
      match = allBooks.find(b => b.amharicName.includes(canonical));
      if (match) {
        return { id: match.id, name: match.name };
      }
    }
  }

  // Try partial word matching (more flexible)
  for (const book of allBooks) {
    // Split the Amharic name and check if any significant part matches
    const bookNameParts = book.amharicName.split(/\s+/);
    for (const part of bookNameParts) {
      if (part.length > 3 && cleanTitle.includes(part)) {
        return { id: book.id, name: book.name };
      }
    }
  }

  return null;
}

async function seedFromVision(filename: string) {
  const filePath = path.join(PROCESSED_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }

  console.log(`\n🌱 Seeding from: ${filename}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content) as ExtractionResult;

  // 1. Identify Book
  // We need to find which book this belongs to. 
  // For now, we'll try to find a "book_title" item or rely on the user to specify, 
  // but let's try to extract it from the first "book_title" item.

  let bookNameAmharic = '';
  let bookId = 0;

  const titleItem = data.items.find(i => i.type === 'book_title');
  if (titleItem && titleItem.text) {
    const identifiedBook = await findBookId(titleItem.text);
    if (identifiedBook) {
      bookId = identifiedBook.id;
      bookNameAmharic = identifiedBook.name;
      console.log(`   📖 Identified Book: ${identifiedBook.name} (${bookNameAmharic})`);
    } else {
      console.log(`   ⚠️  Could not auto-identify book from title: "${titleItem.text}"`);
      // Fallback: If still not found, try to infer from filename or skip
      // For this specific task (Genesis), we know it's ID 1.
      if (titleItem.text.includes('ዘፍጥረት')) {
        bookId = 1;
        console.log(`   📖 Defaulting to Genesis (ID 1)`);
      } else {
        console.log(`   ❌ Skipping - Unknown Book`);
        return;
      }
    }
  } else {
    // If no title found, maybe we can infer from filename or just fail
    console.log(`   ⚠️  No book title found in extraction.`);
    // For testing Genesis, let's default to 1 if we can't find it
    bookId = 1;
  }

  // 2. Group by Chapter
  // We need to group items into chapters.
  // Introduction -> Chapter 0
  // Chapter 1 -> Chapter 1, etc.

  const chapters = new Map<number, ExtractionItem[]>();
  let currentChapter = 0; // Default to Introduction (0) if no chapter header seen yet

  // If the first item is a chapter header, switch immediately
  // But usually there's intro text first.

  for (const item of data.items) {
    if (item.type === 'chapter_header') {
      currentChapter = item.number || currentChapter + 1;
      // Initialize if not exists
      if (!chapters.has(currentChapter)) {
        chapters.set(currentChapter, []);
      }
      // We don't necessarily need to store the chapter header itself as content, 
      // but it helps preserve the flow. Let's keep it.
    }

    if (!chapters.has(currentChapter)) {
      chapters.set(currentChapter, []);
    }

    chapters.get(currentChapter)?.push(item);
  }

  // 3. Insert into DB
  for (const [chapNum, items] of chapters.entries()) {
    console.log(`   📝 Processing Chapter ${chapNum} (${items.length} items)...`);

    // Check existing
    const existing = await db.select().from(chapterContents).where(
      and(
        eq(chapterContents.bookId, bookId),
        eq(chapterContents.chapterNumber, chapNum)
      )
    );

    const jsonContent = JSON.stringify(items);

    if (existing.length > 0) {
      console.log(`      🔄 Updating existing chapter...`);
      await db.update(chapterContents)
        .set({
          content: jsonContent,
          style: 'rich_json', // Mark as our new format
          verified: 1
        })
        .where(eq(chapterContents.id, existing[0].id));
    } else {
      console.log(`      ➕ Inserting new chapter...`);
      await db.insert(chapterContents).values({
        bookId,
        chapterNumber: chapNum,
        content: jsonContent,
        style: 'rich_json',
        verified: 1
      });
    }
  }

  console.log(`✅ Seeding complete for ${filename}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    // Seed specific file
    await seedFromVision(args[0]);
  } else {
    // Seed all in directory
    const files = fs.readdirSync(PROCESSED_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      await seedFromVision(file);
    }
  }
}

main();
