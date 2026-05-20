import fs from 'fs';
import path from 'path';

const INPUT_FILE = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/amharic_bible_extracted.txt';
const OUTPUT_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/formatted_books';

// Book list based on Table of Contents
interface Book {
  num: number;
  amharic: string;
  english: string;
  altMatches?: string[];
  partialMatch?: boolean;
}

const BOOKS: Book[] = [
  { num: 1, amharic: 'ኦሪት ዘፍጥረት', english: 'Genesis' },
  { num: 2, amharic: 'ኦሪት ዘፀአት', english: 'Exodus' },
  { num: 3, amharic: 'ኦሪት ዘሌዋውያን', english: 'Leviticus' },
  { num: 4, amharic: 'ኦሪት ዘኍልቊ', english: 'Numbers' },
  { num: 5, amharic: 'ኦሪት ዘዳግም', english: 'Deuteronomy' },
  { num: 6, amharic: 'መጽሐፈ ኢያሱ', english: 'Joshua' },
  { num: 7, amharic: 'መጽሐፈ መሳፍንት', english: 'Judges' },
  { num: 8, amharic: 'መጽሐፈ ሩት', english: 'Ruth' },
  { num: 9, amharic: '1ኛ መጽሐፈ ሳሙኤል', english: '1_Samuel' },
  { num: 10, amharic: '2ኛ መጽሐፈ ሳሙኤል', english: '2_Samuel' },
  { num: 11, amharic: '1ኛ መጽሐፈ ነገሥት', english: '1_Kings' },
  { num: 12, amharic: '2ኛ መጽሐፈ ነገሥት', english: '2_Kings' },
  { num: 13, amharic: '1ኛ መጽሐፈ ዜና መዋዕል', english: '1_Chronicles' },
  { num: 14, amharic: '2ኛ መጽሐፈ ዜና መዋዕል', english: '2_Chronicles' },
  { num: 15, amharic: 'መጽሐፈ ዕዝራ', english: 'Ezra' },
  { num: 16, amharic: 'መጽሐፈ ነህምያ', english: 'Nehemiah' },
  { num: 17, amharic: 'መጽሐፈ ጦቢት', english: 'Tobit' },
  { num: 18, amharic: 'መጽሐፈ ዮዲት', english: 'Judith' },
  { num: 19, amharic: 'መጽሐፈ አስቴር', english: 'Esther' },
  { num: 20, amharic: '1ኛ መጽሐፈ መቃብያን', english: '1_Maccabees' },
  { num: 21, amharic: '2ኛ መጽሐፈ መቃብያን', english: '2_Maccabees' },
  { num: 22, amharic: 'መጽሐፈ ኢዮብ', english: 'Job' },
  { num: 23, amharic: 'መዝሙረ ዳዊት', english: 'Psalms' },
  { num: 24, amharic: 'መጽሐፈ ምሳሌ', english: 'Proverbs' },
  { num: 25, amharic: 'መጽሐፈ መክብብ', english: 'Ecclesiastes' },
  { num: 26, amharic: 'መኃልየ መኃልይ', english: 'Song_of_Songs', altMatches: ['መኃልየ መኃልይ ዘሰሎሞን'] },
  { num: 27, amharic: 'መጽሐፈ ጥበብ', english: 'Wisdom' },
  { num: 28, amharic: 'መጽሐፈ ሲራክ', english: 'Sirach' },
  { num: 29, amharic: 'ትንቢተ ኢሳይያስ', english: 'Isaiah' },
  { num: 30, amharic: 'ትንቢተ ኤርምያስ', english: 'Jeremiah' },
  { num: 31, amharic: 'ሰቆቃወ ኤርምያስ', english: 'Lamentations' },
  { num: 32, amharic: 'መጽሐፈ ባሮክ', english: 'Baruch' },
  { num: 33, amharic: 'ትንቢተ ሕዝቅኤል', english: 'Ezekiel' },
  { num: 34, amharic: 'ትንቢተ ዳንኤል', english: 'Daniel' },
  { num: 35, amharic: 'ትንቢተ ሆሴዕ', english: 'Hosea' },
  { num: 36, amharic: 'ትንቢተ ኢዩኤል', english: 'Joel' },
  { num: 37, amharic: 'ትንቢተ አሞጽ', english: 'Amos' },
  { num: 38, amharic: 'ትንቢተ አብድዩ', english: 'Obadiah' },
  { num: 39, amharic: 'ትንቢተ ዮናስ', english: 'Jonah' },
  { num: 40, amharic: 'ትንቢተ ሚክያስ', english: 'Micah' },
  { num: 41, amharic: 'ትንቢተ ናሆም', english: 'Nahum' },
  { num: 42, amharic: 'ትንቢተ ዕንባቆም', english: 'Habakkuk' },
  { num: 43, amharic: 'ትንቢተ ሶፎንያስ', english: 'Zephaniah' },
  { num: 44, amharic: 'ትንቢተ ሐጌ', english: 'Haggai' },
  { num: 45, amharic: 'ትንቢተ ዘካርያስ', english: 'Zechariah' },
  { num: 46, amharic: 'ትንቢተ ሚልክያስ', english: 'Malachi' },
  { num: 47, amharic: 'የማቴዎስ ወንጌል', english: 'Matthew', altMatches: ['የጌታችን የኢየሱስ ክርስቶስ ወንጌል'] },
  { num: 48, amharic: 'የማርቆስ ወንጌል', english: 'Mark' },
  { num: 49, amharic: 'የሉቃስ ወንጌል', english: 'Luke' },
  { num: 50, amharic: 'የዮሐንስ ወንጌል', english: 'John' },
  { num: 51, amharic: 'የሐዋርያት ሥራ', english: 'Acts' },
  { num: 52, amharic: 'ወደ ሮሜ ሰዎች', english: 'Romans' },
  { num: 53, amharic: '1ኛ ወደ ቆሮንቶስ ሰዎች', english: '1_Corinthians', altMatches: ['ወደ ቆሮንቶስ ሰዎች'] },
  { num: 54, amharic: '2ኛ ወደ ቆሮንቶስ ሰዎች', english: '2_Corinthians', altMatches: ['ወደ ቆሮንቶስ ሰዎች'] },
  { num: 55, amharic: 'ወደ ገላትያ ሰዎች', english: 'Galatians' },
  { num: 56, amharic: 'ወደ ኤፌሶን ሰዎች', english: 'Ephesians' },
  { num: 57, amharic: 'ወደ ፊልጵስዩስ ሰዎች', english: 'Philippians' },
  { num: 58, amharic: 'ወደ ቈላስይስ ሰዎች', english: 'Colossians' },
  { num: 59, amharic: '1ኛ ወደ ተሰሎንቄ ሰዎች', english: '1_Thessalonians', altMatches: ['ወደ ተሰሎንቄ ሰዎች'] },
  { num: 60, amharic: '2ኛ ወደ ተሰሎንቄ ሰዎች', english: '2_Thessalonians', altMatches: ['ወደ ተሰሎንቄ ሰዎች'] },
  { num: 61, amharic: '1ኛ ወደ ጢሞቴዎስ', english: '1_Timothy', altMatches: ['ወደ ጢሞቴዎስ'] },
  { num: 62, amharic: '2ኛ ወደ ጢሞቴዎስ', english: '2_Timothy', altMatches: ['ወደ ጢሞቴዎስ'] },
  { num: 63, amharic: 'ወደ ቲቶ', english: 'Titus' },
  { num: 64, amharic: 'ወደ ፊልሞና', english: 'Philemon' },
  { num: 65, amharic: 'ወደ ዕብራውያን', english: 'Hebrews' },
  { num: 66, amharic: 'የያዕቆብ መልእክት', english: 'James', altMatches: ['የሐዋርያው የያዕቆብ መልእክት'] },
  { num: 67, amharic: '1ኛ የጴጥሮስ መልእክት', english: '1_Peter', altMatches: ['የጴጥሮስ መልእክት'] },
  { num: 68, amharic: '2ኛ የጴጥሮስ መልእክት', english: '2_Peter', altMatches: ['የጴጥሮስ መልእክት'] },
  { num: 69, amharic: '1ኛ የዮሐንስ መልእክት', english: '1_John', altMatches: ['የዮሐንስ መልእክት'] },
  { num: 70, amharic: '2ኛ የዮሐንስ መልእክት', english: '2_John', altMatches: ['የዮሐንስ መልእክት'] },
  { num: 71, amharic: '3ኛ የዮሐንስ መልእክት', english: '3_John', altMatches: ['ሽማግሌው፥ በእውነት ለምወደው'], partialMatch: true },
  { num: 72, amharic: 'የይሁዳ መልእክት', english: 'Jude' },
  { num: 73, amharic: 'የዮሐንስ ራእይ', english: 'Revelation' },
];

// Normalize Unicode string to handle combining characters and invisible chars
// Normalize Unicode string to handle combining characters and invisible chars
function normalizeTitle(str: string): string {
  return str
    .normalize('NFC')  // Canonical decomposition, followed by canonical composition
    .replace(/[\u00A0\u2007]/g, ' ')  // Replace NBSP and Figure Space with regular space
    .replace(/[\u200B-\u200D\uFEFF\u0008]/g, '') // Remove zero-width chars and backspace
    .trim();
}

function cleanAndFormatLines(lines: string[], bookTitle: string): string {
  let cleanedLines: string[] = [];
  let seenTitle = false;
  let currentChapter = 0;
  let inFootnoteBlock = false;

  for (let line of lines) {
    let trimmed = line.trim();

    if (!trimmed) {
      inFootnoteBlock = false;
      continue;
    }

    if (inFootnoteBlock) {
      const isVerse = /^\d+\s/.test(trimmed);
      const isHeader = trimmed.startsWith('ምዕራፍ') || trimmed === bookTitle || trimmed === 'መግቢያ';
      if (isHeader || isVerse) {
        inFootnoteBlock = false;
      }
    }

    if (inFootnoteBlock) continue;

    // Filter page numbers
    if (/^\d+$/.test(trimmed)) continue;

    // Filter running headers
    if (trimmed.includes(bookTitle)) {
      // Allow title line (exact match or Title + 1)
      const isTitleLine = trimmed === bookTitle || trimmed === `${bookTitle} 1`;
      if (isTitleLine && !seenTitle) {
        seenTitle = true;
      } else {
        continue;
      }
    }

    // Filter footnotes
    if (/^[ሀ-ፐ]\s\d+/.test(trimmed)) {
      inFootnoteBlock = true;
      continue;
    }

    // Filter cross references (starts with Number፥Number)
    if (/^\d+፥/.test(trimmed)) continue;

    // Track chapters
    if (trimmed.startsWith('ምዕራፍ')) {
      const match = trimmed.match(/ምዕራፍ\s*(\d+)/);
      if (match) {
        currentChapter = parseInt(match[1]);
      }
    }

    cleanedLines.push(trimmed);
  }

  // Join into paragraphs
  let formattedText = "";
  let currentParagraph = "";

  for (let i = 0; i < cleanedLines.length; i++) {
    let line = cleanedLines[i];

    const isExplicitHeader =
      line.startsWith('ምዕራፍ') ||
      line === bookTitle ||
      line === 'መግቢያ' ||
      /^[ሀ-ፐ]\.\s/.test(line);

    let isTitle = false;
    if (i > 0) {
      const prevLine = cleanedLines[i - 1];
      if ((prevLine.startsWith('ምዕራፍ') || prevLine === 'መግቢያ') &&
        !/^\d/.test(line) &&
        line.length < 60) {
        isTitle = true;
      }
    }

    if (isExplicitHeader || isTitle) {
      if (currentParagraph) {
        formattedText += currentParagraph + "\n\n";
        currentParagraph = "";
      }
      formattedText += line + "\n\n";
    } else {
      if (currentParagraph) {
        if (!currentParagraph.endsWith(' ')) {
          currentParagraph += " ";
        }
        currentParagraph += line;
      } else {
        currentParagraph = line;
      }
    }
  }

  if (currentParagraph) {
    formattedText += currentParagraph + "\n";
  }

  formattedText = formattedText.replace(/  +/g, ' ');
  formattedText = formattedText.replace(/ \n/g, '\n').replace(/\n /g, '\n');

  return formattedText;
}

function extractAllBooks() {
  try {
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
    const lines = fileContent.split('\n');

    let bookBuffers: Map<number, string[]> = new Map();
    let currentBook: number | null = null;
    let extractedBooks = new Set<number>();

    console.log('Scanning for book titles...\n');

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      let trimmedLine = line.trim();
      let normalizedLine = normalizeTitle(trimmedLine);

      // Special handling for books without titles (2 Kings, 2 Chronicles)
      if (normalizedLine === 'ምዕራፍ 1') {
        let nextBookNum = null;
        if (currentBook === 11 && bookBuffers.get(11)!.length > 2000) { // 1 Kings -> 2 Kings
          nextBookNum = 12;
        } else if (currentBook === 13 && bookBuffers.get(13)!.length > 2000) { // 1 Chronicles -> 2 Chronicles
          nextBookNum = 14;
        }

        if (nextBookNum) {
          const prevBook = BOOKS.find(b => b.num === currentBook)!;
          const nextBook = BOOKS.find(b => b.num === nextBookNum)!;

          // Save previous book
          const content = cleanAndFormatLines(bookBuffers.get(currentBook!)!, prevBook.amharic);
          const filename = `${String(prevBook.num).padStart(2, '0')}_${prevBook.english}_Amharic.txt`;
          const filepath = path.join(OUTPUT_DIR, filename);
          fs.writeFileSync(filepath, content);
          console.log(`✓ Saved: ${prevBook.english} (${bookBuffers.get(currentBook!)!.length} lines) → ${filename}`);

          // Start new book
          console.log(`📖 Found: ${nextBook.english} at line ${i + 1} (Transition)`);
          currentBook = nextBookNum;
          extractedBooks.add(currentBook);
          bookBuffers.set(currentBook, []);
          // Don't break, continue processing this line as part of the new book
        }
      }

      // Check if this line starts a new book
      for (let book of BOOKS) {
        // Skip if already extracted
        if (extractedBooks.has(book.num)) continue;

        let isMatch = false;

        // 1. Check standard Amharic title
        let normalizedBookTitle = normalizeTitle(book.amharic);
        if (normalizedLine === normalizedBookTitle || normalizedLine === `${normalizedBookTitle} 1`) {
          isMatch = true;
        }

        // 2. Check alternative matches
        if (!isMatch && book.altMatches) {
          for (let alt of book.altMatches) {
            let normalizedAlt = normalizeTitle(alt);
            if (book.partialMatch) {
              if (normalizedLine.includes(normalizedAlt)) {
                isMatch = true;
                break;
              }
            } else {
              // Check for exact match or if the line starts with the alt match
              if (normalizedLine === normalizedAlt || normalizedLine.startsWith(normalizedAlt)) {
                isMatch = true;
                break;
              }
            }
          }
        }

        if (isMatch) {
          // Save previous book if exists
          if (currentBook !== null && bookBuffers.has(currentBook)) {
            const prevBook = BOOKS.find(b => b.num === currentBook)!;
            const content = cleanAndFormatLines(bookBuffers.get(currentBook)!, prevBook.amharic);
            const filename = `${String(prevBook.num).padStart(2, '0')}_${prevBook.english}_Amharic.txt`;
            const filepath = path.join(OUTPUT_DIR, filename);
            fs.writeFileSync(filepath, content);
            console.log(`✓ Saved: ${prevBook.english} (${bookBuffers.get(currentBook)!.length} lines) → ${filename}`);
          }

          // Start new book
          console.log(`📖 Found: ${book.english} at line ${i + 1}`);
          currentBook = book.num;
          extractedBooks.add(currentBook);
          bookBuffers.set(currentBook, []);
          break; // Stop checking other books for this line
        }
      }

      // Add line to current book buffer
      if (currentBook !== null) {
        bookBuffers.get(currentBook)!.push(line);
      }
    }

    // Save last book
    if (currentBook !== null && bookBuffers.has(currentBook)) {
      const lastBook = BOOKS.find(b => b.num === currentBook)!;
      const content = cleanAndFormatLines(bookBuffers.get(currentBook)!, lastBook.amharic);
      const filename = `${String(lastBook.num).padStart(2, '0')}_${lastBook.english}_Amharic.txt`;
      const filepath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filepath, content);
      console.log(`✓ ${lastBook.english} (${bookBuffers.get(currentBook)!.length} lines) → ${filename}`);
    }

    console.log(`\n✅ Extraction complete! Processed ${BOOKS.length} books.`);

  } catch (error) {
    console.error('Error:', error);
  }
}

extractAllBooks();
