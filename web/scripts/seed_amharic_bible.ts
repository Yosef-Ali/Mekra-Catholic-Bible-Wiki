import fs from 'fs';
import path from 'path';
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq } from 'drizzle-orm';

const FORMATTED_BOOKS_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/formatted_books';

// Comprehensive Amharic title mapping for all 73 books
const AMHARIC_TITLES: Record<number, string> = {
  1: 'ኦሪት ዘፍጥረት',
  2: 'ኦሪት ዘፀአት',
  3: 'ኦሪት ዘሌዋውያን',
  4: 'ኦሪት ዘኍልቊ',
  5: 'ኦሪት ዘዳግም',
  6: 'መጽሐፈ ኢያሱ',
  7: 'መጽሐፈ መሳፍንት',
  8: 'መጽሐፈ ሩት',
  9: '1ኛ መጽሐፈ ሳሙኤል',
  10: '2ኛ መጽሐፈ ሳሙኤል',
  11: '1ኛ መጽሐፈ ነገሥት',
  12: '2ኛ መጽሐፈ ነገሥት',
  13: '1ኛ መጽሐፈ ዜና መዋዕል',
  14: '2ኛ መጽሐፈ ዜና መዋዕል',
  15: 'መጽሐፈ ዕዝራ',
  16: 'መጽሐፈ ነህምያ',
  17: 'መጽሐፈ ጦቢት',
  18: 'መጽሐፈ ዮዲት',
  19: 'መጽሐፈ አስቴር',
  20: '1ኛ መጽሐፈ መቃብያን',
  21: '2ኛ መጽሐፈ መቃብያን',
  22: 'መጽሐፈ ኢዮብ',
  23: 'መዝሙረ ዳዊት',
  24: 'መጽሐፈ ምሳሌ',
  25: 'መጽሐፈ መክብብ',
  26: 'መኃልየ መኃልይ',
  27: 'መጽሐፈ ጥበብ',
  28: 'መጽሐፈ ሲራክ',
  29: 'ትንቢተ ኢሳይያስ',
  30: 'ትንቢተ ኤርምያስ',
  31: 'ሰቆቃወ ኤርምያስ',
  32: 'መጽሐፈ ባሮክ',
  33: 'ትንቢተ ሕዝቅኤል',
  34: 'ትንቢተ ዳንኤል',
  35: 'ትንቢተ ሆሴዕ',
  36: 'ትንቢተ ኢዩኤል',
  37: 'ትንቢተ አሞጽ',
  38: 'ትንቢተ አብድዩ',
  39: 'ትንቢተ ዮናስ',
  40: 'ትንቢተ ሚክያስ',
  41: 'ትንቢተ ናሆም',
  42: 'ትንቢተ ዕንባቆም',
  43: 'ትንቢተ ሶፎንያስ',
  44: 'ትንቢተ ሐጌ',
  45: 'ትንቢተ ዘካርያስ',
  46: 'ትንቢተ ሚልክያስ',
  47: 'የማቴዎስ ወንጌል',
  48: 'የማርቆስ ወንጌል',
  49: 'የሉቃስ ወንጌል',
  50: 'የዮሐንስ ወንጌል',
  51: 'የሐዋርያት ሥራ',
  52: 'ወደ ሮሜ ሰዎች',
  53: '1ኛ ወደ ቆሮንቶስ ሰዎች',
  54: '2ኛ ወደ ቆሮንቶስ ሰዎች',
  55: 'ወደ ገላትያ ሰዎች',
  56: 'ወደ ኤፌሶን ሰዎች',
  57: 'ወደ ፊልጵስዩስ ሰዎች',
  58: 'ወደ ቈላስይስ ሰዎች',
  59: '1ኛ ወደ ተሰሎንቄ ሰዎች',
  60: '2ኛ ወደ ተሰሎንቄ ሰዎች',
  61: '1ኛ ወደ ጢሞቴዎስ',
  62: '2ኛ ወደ ጢሞቴዎስ',
  63: 'ወደ ቲቶ',
  64: 'ወደ ፊልሞና',
  65: 'ወደ ዕብራውያን',
  66: 'የያዕቆብ መልእክት',
  67: '1ኛ የጴጥሮስ መልእክት',
  68: '2ኛ የጴጥሮስ መልእክት',
  69: '1ኛ የዮሐንስ መልእክት',
  70: '2ኛ የዮሐንስ መልእክት',
  71: '3ኛ የዮሐንስ መልእክት',
  72: 'የይሁዳ መልእክት',
  73: 'የዮሐንስ ራእይ',
};

async function seedAmharicBible() {
  console.log('🚀 Starting Amharic Bible Seeding...');

  try {
    // 1. Clear existing data
    console.log('🗑️  Clearing existing data...');
    await db.delete(chapterContents);
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
      // Read file content
      let content = fs.readFileSync(filePath, 'utf-8');

      // Normalize line endings
      content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // Ensure chapters start on new lines (handle concatenated files like Psalms)
      // Looks for '።' followed by 'ምዕራፍ' or 'መዝሙር' and a number
      content = content.replace(/([።])\s*(?=(?:ምዕራፍ|መዝሙር)\s+\d+)/g, '$1\n');

      // NEW: Handle inline subtitles
      // Look for: [Full Stop] [Space] [Subtitle Text] [Space] [Verse Number]
      // We want to turn this into: [Full Stop]\n[Subtitle Text]\n[Verse Number]
      // Regex explanation:
      // ([።]) -> Capture full stop
      // \s+ -> Match spaces
      // ([^0-9\n]+?) -> Capture subtitle text (non-numbers, non-newlines, lazy)
      // \s+ -> Match spaces
      // (?=\d+\s) -> Lookahead for verse number followed by space
      content = content.replace(/([።])\s+([^0-9\n]+?)\s+(?=\d+\s)/g, '$1\n$2\n');

      const lines = content.split('\n');

      // Parse filename: 01_Genesis_Amharic.txt
      const parts = file.split('_');
      const bookNumber = parseInt(parts[0]);
      const englishName = parts[1];

      // Use mapped Amharic title
      const amharicTitle = AMHARIC_TITLES[bookNumber] || englishName;

      // Re-split content after replacements to get fresh lines
      const processedLines = content.split('\n').map(l => l.trim()).filter(l => l);

      // Parse Chapters
      const chapterData = [];
      let currentChapterNum = 0;
      let currentChapterText = '';
      let inIntro = false;

      for (let i = 0; i < processedLines.length; i++) {
        const line = processedLines[i].replace(/\u00A0/g, ' ').trim();
        if (!line) continue;

        // Skip Title
        if (line === amharicTitle) continue;

        // Check for Chapter Header
        // Support both 'ምዕራፍ' (Chapter) and 'መዝሙር' (Psalm)
        const chapterMatch = line.match(/^(?:ምዕራፍ|መዝሙር)\s+(\d+)/);
        if (chapterMatch) {
          if (currentChapterNum > 0 && currentChapterText) {
            chapterData.push({ num: currentChapterNum, text: currentChapterText.trim() });
          }
          currentChapterNum = parseInt(chapterMatch[1]);
          currentChapterText = '';
          inIntro = false; // Reset intro flag when explicit chapter starts
          continue;
        }

        // Check for Intro Header
        if (line === 'መግቢያ') {
          inIntro = true;
          continue;
        }

        // Handle Content
        if (currentChapterNum > 0) {
          // Normal case: We are inside a chapter
          currentChapterText += line + ' ';
        } else {
          // We are at the start (Chapter 0), check for Implicit Chapter 1
          if (inIntro) {
            // If in Intro, only start Chapter 1 if we see a verse number
            // This handles books like Revelation that have a long intro before verses
            if (/^\d+/.test(line)) {
              currentChapterNum = 1;
              currentChapterText += line + ' ';
              inIntro = false;
            }
          } else {
            // If NOT in Intro, and not a Title (already skipped), assume this is Chapter 1 content
            // This handles books like 1 Chronicles that start immediately with text
            currentChapterNum = 1;
            currentChapterText += line + ' ';
          }
        }
      }

      // Push the last chapter
      if (currentChapterNum > 0 && currentChapterText) {
        chapterData.push({ num: currentChapterNum, text: currentChapterText.trim() });
      }

      // Handle single-chapter books (2 John, 3 John, Philemon, etc.)
      // If no chapters found but there is content, treat the entire book as chapter 1
      if (chapterData.length === 0 && processedLines.length > 0) {
        // Find verse content (skip title and intro lines)
        let verseContent = '';
        for (const line of processedLines) {
          const normalized = line.replace(/\u00A0/g, ' ').trim();
          // Skip title, intro headers, and cross-refs
          if (normalized === amharicTitle ||
            normalized === 'መግቢያ' ||
            /^\d+፥/.test(normalized) ||
            normalized.length < 20) {
            continue;
          }
          // Check if it's verse text (starts with number followed by space and Amharic letter)
          if (/^\d+\s/.test(normalized)) {
            verseContent += normalized + ' ';
          }
        }

        if (verseContent.trim()) {
          chapterData.push({ num: 1, text: verseContent.trim() });
        }
      }

      console.log(`\nProcessing Book ${bookNumber}: ${englishName} (${amharicTitle}) - ${chapterData.length} Chapters`);

      // Insert Book
      const [insertedBook] = await db.insert(books).values({
        id: bookNumber,
        name: englishName,
        amharicName: amharicTitle,
        chapters: chapterData.length,
        section: bookNumber <= 46 ? 'OT' : 'NT',
      }).returning();

      // Insert Chapters
      for (const chap of chapterData) {
        // Determine style
        let style = 'prose';
        // Heuristic for poetry: Psalms, or specific chapters known to be poetry
        if (englishName === 'Psalms' || (englishName === 'Genesis' && chap.num === 49)) {
          style = 'poetry';
        }

        await db.insert(chapterContents).values({
          bookId: insertedBook.id,
          chapterNumber: chap.num,
          content: chap.text,
          style: style,
          verified: 1,
        });
      }
    }

    console.log('🎉 Seeding Complete!');
  } catch (error) {
    console.error('❌ Seeding Failed:', error);
    process.exit(1);
  }
}

seedAmharicBible();
