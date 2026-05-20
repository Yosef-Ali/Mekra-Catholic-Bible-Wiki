import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Canonical book order (Catholic Canon - 73 books)
const BOOK_ORDER = [
  // Pentateuch (5)
  { file: 'Genesis', name: 'Genesis', amharic: 'ኦሪት ዘፍጥረት', section: 'OT' },
  { file: 'Exodus', name: 'Exodus', amharic: 'ኦሪት ዘፀአት', section: 'OT' },
  { file: 'Leviticus', name: 'Leviticus', amharic: 'ኦሪት ዘሌዋውያን', section: 'OT' },
  { file: 'Numbers', name: 'Numbers', amharic: 'ኦሪት ዘኍልቍ', section: 'OT' },
  { file: 'Deuteronomy', name: 'Deuteronomy', amharic: 'ኦሪት ዘዳግም', section: 'OT' },
  // Historical (16)
  { file: 'Joshua', name: 'Joshua', amharic: 'መጽሐፈ ኢያሱ', section: 'OT' },
  { file: 'Judges', name: 'Judges', amharic: 'መጽሐፈ መሣፍንት', section: 'OT' },
  { file: 'Ruth', name: 'Ruth', amharic: 'መጽሐፈ ሩት', section: 'OT' },
  { file: '1_Samuel', name: '1 Samuel', amharic: '1ኛ ሳሙኤል', section: 'OT' },
  { file: '2_Samuel', name: '2 Samuel', amharic: '2ኛ ሳሙኤል', section: 'OT' },
  { file: '1_Kings', name: '1 Kings', amharic: '1ኛ ነገሥት', section: 'OT' },
  { file: '2_Kings', name: '2 Kings', amharic: '2ኛ ነገሥት', section: 'OT' },
  { file: '1_Chronicles', name: '1 Chronicles', amharic: '1ኛ ዜና መዋዕል', section: 'OT' },
  { file: '2_Chronicles', name: '2 Chronicles', amharic: '2ኛ ዜና መዋዕል', section: 'OT' },
  { file: 'Ezra', name: 'Ezra', amharic: 'መጽሐፈ ዕዝራ', section: 'OT' },
  { file: 'Nehemiah', name: 'Nehemiah', amharic: 'መጽሐፈ ነህምያ', section: 'OT' },
  { file: 'Tobit', name: 'Tobit', amharic: 'መጽሐፈ ጦቢት', section: 'Apocrypha' },
  { file: 'Judith', name: 'Judith', amharic: 'መጽሐፈ ይሁዲት', section: 'Apocrypha' },
  { file: 'Esther', name: 'Esther', amharic: 'መጽሐፈ አስቴር', section: 'OT' },
  { file: '1_Maccabees', name: '1 Maccabees', amharic: '1ኛ መቃብያን', section: 'Apocrypha' },
  { file: '2_Maccabees', name: '2 Maccabees', amharic: '2ኛ መቃብያን', section: 'Apocrypha' },
  // Wisdom (7)
  { file: 'Job', name: 'Job', amharic: 'መጽሐፈ ኢዮብ', section: 'OT' },
  { file: 'Psalms', name: 'Psalms', amharic: 'መዝሙረ ዳዊት', section: 'OT' },
  { file: 'Proverbs', name: 'Proverbs', amharic: 'መጽሐፈ ምሳሌ', section: 'OT' },
  { file: 'Ecclesiastes', name: 'Ecclesiastes', amharic: 'መጽሐፈ መክብብ', section: 'OT' },
  { file: 'Song_of_Songs', name: 'Song of Songs', amharic: 'መኃልየ መኃልይ', section: 'OT' },
  { file: 'Wisdom', name: 'Wisdom', amharic: 'መጽሐፈ ጥበብ', section: 'Apocrypha' },
  { file: 'Sirach', name: 'Sirach', amharic: 'መጽሐፈ ሲራክ', section: 'Apocrypha' },
  // Prophets (18)
  { file: 'Isaiah', name: 'Isaiah', amharic: 'ትንቢተ ኢሳይያስ', section: 'OT' },
  { file: 'Jeremiah', name: 'Jeremiah', amharic: 'ትንቢተ ኤርምያስ', section: 'OT' },
  { file: 'Lamentations', name: 'Lamentations', amharic: 'ሰቆቃወ ኤርምያስ', section: 'OT' },
  { file: 'Baruch', name: 'Baruch', amharic: 'መጽሐፈ ባሮክ', section: 'Apocrypha' },
  { file: 'Ezekiel', name: 'Ezekiel', amharic: 'ትንቢተ ሕዝቅኤል', section: 'OT' },
  { file: 'Daniel', name: 'Daniel', amharic: 'ትንቢተ ዳንኤል', section: 'OT' },
  { file: 'Hosea', name: 'Hosea', amharic: 'ትንቢተ ሆሴዕ', section: 'OT' },
  { file: 'Joel', name: 'Joel', amharic: 'ትንቢተ ኢዩኤል', section: 'OT' },
  { file: 'Amos', name: 'Amos', amharic: 'ትንቢተ አሞጽ', section: 'OT' },
  { file: 'Obadiah', name: 'Obadiah', amharic: 'ትንቢተ አብድዩ', section: 'OT' },
  { file: 'Jonah', name: 'Jonah', amharic: 'ትንቢተ ዮናስ', section: 'OT' },
  { file: 'Micah', name: 'Micah', amharic: 'ትንቢተ ሚክያስ', section: 'OT' },
  { file: 'Nahum', name: 'Nahum', amharic: 'ትንቢተ ናሆም', section: 'OT' },
  { file: 'Habakkuk', name: 'Habakkuk', amharic: 'ትንቢተ ዕንባቆም', section: 'OT' },
  { file: 'Zephaniah', name: 'Zephaniah', amharic: 'ትንቢተ ሶፎንያስ', section: 'OT' },
  { file: 'Haggai', name: 'Haggai', amharic: 'ትንቢተ ሐጌ', section: 'OT' },
  { file: 'Zechariah', name: 'Zechariah', amharic: 'ትንቢተ ዘካርያስ', section: 'OT' },
  { file: 'Malachi', name: 'Malachi', amharic: 'ትንቢተ ሚልክያስ', section: 'OT' },
  // Gospels & Acts (5)
  { file: 'Matthew', name: 'Matthew', amharic: 'የማቴዎስ ወንጌል', section: 'NT' },
  { file: 'Mark', name: 'Mark', amharic: 'የማርቆስ ወንጌል', section: 'NT' },
  { file: 'Luke', name: 'Luke', amharic: 'የሉቃስ ወንጌል', section: 'NT' },
  { file: 'John', name: 'John', amharic: 'የዮሐንስ ወንጌል', section: 'NT' },
  { file: 'Acts', name: 'Acts', amharic: 'የሐዋርያት ሥራ', section: 'NT' },
  // Pauline Epistles (14)
  { file: 'Romans', name: 'Romans', amharic: 'ወደ ሮሜ ሰዎች', section: 'NT' },
  { file: '1_Corinthians', name: '1 Corinthians', amharic: '1ኛ ወደ ቆሮንቶስ', section: 'NT' },
  { file: '2_Corinthians', name: '2 Corinthians', amharic: '2ኛ ወደ ቆሮንቶስ', section: 'NT' },
  { file: 'Galatians', name: 'Galatians', amharic: 'ወደ ገላትያ', section: 'NT' },
  { file: 'Ephesians', name: 'Ephesians', amharic: 'ወደ ኤፌሶን', section: 'NT' },
  { file: 'Philippians', name: 'Philippians', amharic: 'ወደ ፊልጵስዩስ', section: 'NT' },
  { file: 'Colossians', name: 'Colossians', amharic: 'ወደ ቆላስይስ', section: 'NT' },
  { file: '1_Thessalonians', name: '1 Thessalonians', amharic: '1ኛ ወደ ተሰሎንቄ', section: 'NT' },
  { file: '2_Thessalonians', name: '2 Thessalonians', amharic: '2ኛ ወደ ተሰሎንቄ', section: 'NT' },
  { file: '1_Timothy', name: '1 Timothy', amharic: '1ኛ ወደ ጢሞቴዎስ', section: 'NT' },
  { file: '2_Timothy', name: '2 Timothy', amharic: '2ኛ ወደ ጢሞቴዎስ', section: 'NT' },
  { file: 'Titus', name: 'Titus', amharic: 'ወደ ቲቶ', section: 'NT' },
  { file: 'Philemon', name: 'Philemon', amharic: 'ወደ ፊልሞና', section: 'NT' },
  { file: 'Hebrews', name: 'Hebrews', amharic: 'ወደ ዕብራውያን', section: 'NT' },
  // General Epistles & Revelation (8)
  { file: 'James', name: 'James', amharic: 'የያዕቆብ መልእክት', section: 'NT' },
  { file: '1_Peter', name: '1 Peter', amharic: '1ኛ የጴጥሮስ መልእክት', section: 'NT' },
  { file: '2_Peter', name: '2 Peter', amharic: '2ኛ የጴጥሮስ መልእክት', section: 'NT' },
  { file: '1_John', name: '1 John', amharic: '1ኛ የዮሐንስ መልእክት', section: 'NT' },
  { file: '2_John', name: '2 John', amharic: '2ኛ የዮሐንስ መልእክት', section: 'NT' },
  { file: '3_John', name: '3 John', amharic: '3ኛ የዮሐንስ መልእክት', section: 'NT' },
  { file: 'Jude', name: 'Jude', amharic: 'የይሁዳ መልእክት', section: 'NT' },
  { file: 'Revelation', name: 'Revelation', amharic: 'የዮሐንስ ራእይ', section: 'NT' },
];

const EXTRACTION_DIR = path.join(__dirname, '..', 'extraction_output');

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
  book: {
    book_name: string;
    book_name_amharic: string;
    total_chapters: number;
    chapters: ExtractedChapter[];
  };
}

async function loadExtractedBook(filename: string): Promise<ExtractedBook | null> {
  const filepath = path.join(EXTRACTION_DIR, `${filename}_extracted.json`);
  if (!fs.existsSync(filepath)) {
    console.log(`   ⚠️ File not found: ${filepath}`);
    return null;
  }
  const data = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(data) as ExtractedBook;
}

async function seedCompleteBible() {
  console.log('🚀 COMPLETE BIBLE SEEDING');
  console.log('='.repeat(70));
  console.log(`📂 Extraction directory: ${EXTRACTION_DIR}`);
  console.log(`📚 Books to seed: ${BOOK_ORDER.length}`);
  console.log('');

  // Step 1: Clear existing data
  console.log('🗑️  Step 1: Clearing existing data...');
  await db.delete(chapterContents);
  await db.delete(books);
  console.log('   ✅ Cleared all existing books and chapters');

  // Step 2: Load all extracted books and get chapter counts
  console.log('\n📖 Step 2: Loading extracted books...');
  const bookData: { config: typeof BOOK_ORDER[0]; extracted: ExtractedBook }[] = [];
  
  for (const config of BOOK_ORDER) {
    const extracted = await loadExtractedBook(config.file);
    if (extracted) {
      bookData.push({ config, extracted });
      console.log(`   ✅ ${config.name.padEnd(20)} - ${extracted.book.chapters.length} chapters`);
    } else {
      console.log(`   ❌ ${config.name.padEnd(20)} - MISSING`);
    }
  }

  if (bookData.length !== BOOK_ORDER.length) {
    console.log(`\n⚠️ WARNING: Only ${bookData.length}/${BOOK_ORDER.length} books found!`);
  }

  // Step 3: Insert all books
  console.log('\n📚 Step 3: Inserting books into database...');
  const bookIdMap = new Map<string, number>();
  
  for (const { config, extracted } of bookData) {
    const [insertedBook] = await db.insert(books).values({
      name: config.name,
      amharicName: config.amharic,
      chapters: extracted.book.chapters.length,
      section: config.section,
    }).returning({ id: books.id });
    
    bookIdMap.set(config.file, insertedBook.id);
    console.log(`   ✅ ${config.name.padEnd(20)} ID: ${insertedBook.id}`);
  }

  // Step 4: Seed all chapters
  console.log('\n📄 Step 4: Seeding chapter contents...');
  let totalChapters = 0;
  let totalVerses = 0;

  for (const { config, extracted } of bookData) {
    const bookId = bookIdMap.get(config.file);
    if (!bookId) continue;

    const chapters = extracted.book.chapters;
    for (const chapter of chapters) {
      const verseCount = chapter.sections.reduce((sum, s) => sum + s.verses.length, 0);
      
      await db.insert(chapterContents).values({
        bookId: bookId,
        chapterNumber: chapter.chapter_number,
        content: chapter, // Store entire chapter object as JSON
        style: 'prose',
        verified: 0,
      });
      
      totalChapters++;
      totalVerses += verseCount;
    }
    console.log(`   ✅ ${config.name.padEnd(20)} - ${chapters.length} chapters seeded`);
  }

  // Final Summary
  console.log('\n' + '='.repeat(70));
  console.log('✅ SEEDING COMPLETE!');
  console.log('='.repeat(70));
  console.log(`📚 Books seeded: ${bookData.length}`);
  console.log(`📄 Chapters seeded: ${totalChapters}`);
  console.log(`📝 Total verses: ${totalVerses}`);
  
  // Verify counts
  const bookCount = await db.select({ count: sql<number>`count(*)` }).from(books);
  const chapterCount = await db.select({ count: sql<number>`count(*)` }).from(chapterContents);
  
  console.log('\n📊 Database verification:');
  console.log(`   Books in DB: ${bookCount[0].count}`);
  console.log(`   Chapters in DB: ${chapterCount[0].count}`);
}

// Run the seeding
seedCompleteBible()
  .then(() => {
    console.log('\n🎉 Bible seeding completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Error during seeding:', err);
    process.exit(1);
  });
