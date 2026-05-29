/**
 * Direct Database Seeding Script
 * Run with: npx tsx seed-books-now.ts
 */

import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { books } from "../services/schema";

// Load environment variables
dotenv.config();

// Define all 73 Catholic Bible books
const CATHOLIC_BOOKS = [
  // --- OLD TESTAMENT (Pentateuch) ---
  { name: "Genesis", amharicName: "ኦሪት ዘፍጥረት", chapters: 50, section: 'OT' },
  { name: "Exodus", amharicName: "ኦሪት ዘጸአት", chapters: 40, section: 'OT' },
  { name: "Leviticus", amharicName: "ኦሪት ዘሌዋውያን", chapters: 27, section: 'OT' },
  { name: "Numbers", amharicName: "ኦሪት ዘኍልቁ", chapters: 36, section: 'OT' },
  { name: "Deuteronomy", amharicName: "ኦሪት ዘዳግም", chapters: 34, section: 'OT' },

  // --- HISTORICAL BOOKS ---
  { name: "Joshua", amharicName: "መጽሐፈ ኢያሱ", chapters: 24, section: 'OT' },
  { name: "Judges", amharicName: "መጽሐፈ መሳፍንት", chapters: 21, section: 'OT' },
  { name: "Ruth", amharicName: "መጽሐፈ ሩት", chapters: 4, section: 'OT' },
  { name: "1 Samuel", amharicName: "1ኛ መጽሐፈ ሳሙኤል", chapters: 31, section: 'OT' },
  { name: "2 Samuel", amharicName: "2ኛ መጽሐፈ ሳሙኤል", chapters: 24, section: 'OT' },
  { name: "1 Kings", amharicName: "1ኛ መጽሐፈ ነገሥት", chapters: 22, section: 'OT' },
  { name: "2 Kings", amharicName: "2ኛ መጽሐፈ ነገሥት", chapters: 25, section: 'OT' },
  { name: "1 Chronicles", amharicName: "1ኛ መጽሐፈ ዜና መዋዕል", chapters: 29, section: 'OT' },
  { name: "2 Chronicles", amharicName: "2ኛ መጽሐፈ ዜና መዋዕል", chapters: 36, section: 'OT' },
  { name: "Ezra", amharicName: "መጽሐፈ ዕዝራ", chapters: 10, section: 'OT' },
  { name: "Nehemiah", amharicName: "መጽሐፈ ነህምያ", chapters: 13, section: 'OT' },
  { name: "Tobit", amharicName: "መጽሐፈ ጦቢት", chapters: 14, section: 'Apocrypha' },
  { name: "Judith", amharicName: "መጽሐፈ ዮዲት", chapters: 16, section: 'Apocrypha' },
  { name: "Esther", amharicName: "መጽሐፈ አስቴር", chapters: 10, section: 'OT' },
  { name: "1 Maccabees", amharicName: "1ኛ መጽሐፈ መቃብያን", chapters: 16, section: 'Apocrypha' },
  { name: "2 Maccabees", amharicName: "2ኛ መጽሐፈ መቃብያን", chapters: 15, section: 'Apocrypha' },

  // --- WISDOM BOOKS ---
  { name: "Job", amharicName: "መጽሐፈ ኢዮብ", chapters: 42, section: 'OT' },
  { name: "Psalms", amharicName: "መዝሙረ ዳዊት", chapters: 150, section: 'OT' },
  { name: "Proverbs", amharicName: "መጽሐፈ ምሳሌ", chapters: 31, section: 'OT' },
  { name: "Ecclesiastes", amharicName: "መጽሐፈ መክብብ", chapters: 12, section: 'OT' },
  { name: "Song of Solomon", amharicName: "መኃልየ መኃልይ ዘሰሎሞን", chapters: 8, section: 'OT' },
  { name: "Wisdom of Solomon", amharicName: "መጽሐፈ ጥበብ", chapters: 19, section: 'Apocrypha' },
  { name: "Sirach", amharicName: "መጽሐፈ ሲራክ", chapters: 51, section: 'Apocrypha' },

  // --- PROPHETIC BOOKS ---
  { name: "Isaiah", amharicName: "ትንቢተ ኢሳይያስ", chapters: 66, section: 'OT' },
  { name: "Jeremiah", amharicName: "ትንቢተ ኤርምያስ", chapters: 52, section: 'OT' },
  { name: "Lamentations", amharicName: "ሰቆቃወ ኤርምያስ", chapters: 5, section: 'OT' },
  { name: "Baruch", amharicName: "ትንቢተ ባሮክ", chapters: 6, section: 'Apocrypha' },
  { name: "Ezekiel", amharicName: "ትንቢተ ሕዝቅኤል", chapters: 48, section: 'OT' },
  { name: "Daniel", amharicName: "ትንቢተ ዳንኤል", chapters: 12, section: 'OT' },
  { name: "Hosea", amharicName: "ትንቢተ ሆሴዕ", chapters: 14, section: 'OT' },
  { name: "Joel", amharicName: "ትንቢተ ኢዮኤል", chapters: 3, section: 'OT' },
  { name: "Amos", amharicName: "ትንቢተ አሞጽ", chapters: 9, section: 'OT' },
  { name: "Obadiah", amharicName: "ትንቢተ አብድዩ", chapters: 1, section: 'OT' },
  { name: "Jonah", amharicName: "ትንቢተ ዮናስ", chapters: 4, section: 'OT' },
  { name: "Micah", amharicName: "ትንቢተ ሚክያስ", chapters: 7, section: 'OT' },
  { name: "Nahum", amharicName: "ትንቢተ ናሕዩም", chapters: 3, section: 'OT' },
  { name: "Habakkuk", amharicName: "ትንቢተ ሐባቅቆቅ", chapters: 3, section: 'OT' },
  { name: "Zephaniah", amharicName: "ትንቢተ ሶፍንያስ", chapters: 3, section: 'OT' },
  { name: "Haggai", amharicName: "ትንቢተ ሐገይ", chapters: 2, section: 'OT' },
  { name: "Zechariah", amharicName: "ትንቢተ ዛክርያስ", chapters: 14, section: 'OT' },
  { name: "Malachi", amharicName: "ትንቢተ ማላክ", chapters: 4, section: 'OT' },

  // --- NEW TESTAMENT (Gospels) ---
  { name: "Matthew", amharicName: "ወንጌል ማቴዎስ", chapters: 28, section: 'NT' },
  { name: "Mark", amharicName: "ወንጌል ማርቆስ", chapters: 16, section: 'NT' },
  { name: "Luke", amharicName: "ወንጌል ሉቃ", chapters: 24, section: 'NT' },
  { name: "John", amharicName: "ወንጌል ዮሐንስ", chapters: 21, section: 'NT' },

  // --- ACTS AND EPISTLES ---
  { name: "Acts", amharicName: "ስራወ ሐዋርያት", chapters: 28, section: 'NT' },
  { name: "Romans", amharicName: "ደብተራ ሮሜ", chapters: 16, section: 'NT' },
  { name: "1 Corinthians", amharicName: "1ኛ ደብተራ ቆሪንቶስ", chapters: 16, section: 'NT' },
  { name: "2 Corinthians", amharicName: "2ኛ ደብተራ ቆሪንቶስ", chapters: 13, section: 'NT' },
  { name: "Galatians", amharicName: "ደብተራ ጋላቴያ", chapters: 6, section: 'NT' },
  { name: "Ephesians", amharicName: "ደብተራ ኤፌሳውያን", chapters: 6, section: 'NT' },
  { name: "Philippians", amharicName: "ደብተራ ፊሊፒሳውያን", chapters: 4, section: 'NT' },
  { name: "Colossians", amharicName: "ደብተራ ቆሎሳውያን", chapters: 4, section: 'NT' },
  { name: "1 Thessalonians", amharicName: "1ኛ ደብተራ ተሰሎንቅያ", chapters: 5, section: 'NT' },
  { name: "2 Thessalonians", amharicName: "2ኛ ደብተራ ተሰሎንቅያ", chapters: 3, section: 'NT' },
  { name: "1 Timothy", amharicName: "1ኛ ደብተራ ጢሞቴዎስ", chapters: 6, section: 'NT' },
  { name: "2 Timothy", amharicName: "2ኛ ደብተራ ጢሞቴዎስ", chapters: 4, section: 'NT' },
  { name: "Titus", amharicName: "ደብተራ ጦስ", chapters: 3, section: 'NT' },
  { name: "Philemon", amharicName: "ደብተራ ፍሌሞን", chapters: 1, section: 'NT' },
  { name: "Hebrews", amharicName: "ደብተራ ዕብራውያን", chapters: 13, section: 'NT' },
  { name: "James", amharicName: "ደብተራ ያዕቆብ", chapters: 5, section: 'NT' },
  { name: "1 Peter", amharicName: "1ኛ ደብተራ ጴጥሮስ", chapters: 5, section: 'NT' },
  { name: "2 Peter", amharicName: "2ኛ ደብተራ ጴጥሮስ", chapters: 3, section: 'NT' },
  { name: "1 John", amharicName: "1ኛ ደብተራ ዮሐንስ", chapters: 5, section: 'NT' },
  { name: "2 John", amharicName: "2ኛ ደብተራ ዮሐንስ", chapters: 1, section: 'NT' },
  { name: "3 John", amharicName: "3ኛ ደብተራ ዮሐንስ", chapters: 1, section: 'NT' },
  { name: "Jude", amharicName: "ደብተራ ዩዳ", chapters: 1, section: 'NT' },
  { name: "Revelation", amharicName: "ራእይ ዮሐንስ", chapters: 22, section: 'NT' },
];

async function seedBooks() {
  console.log("\n" + "=".repeat(80));
  console.log("📖 SEEDING CATHOLIC BIBLE BOOKS TO NEON DATABASE");
  console.log("=".repeat(80) + "\n");

  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error("❌ ERROR: DATABASE_URL not found in .env file");
    process.exit(1);
  }

  try {
    console.log(`📡 Connecting to Neon PostgreSQL...`);
    const sql = neon(dbUrl);
    const db = drizzle(sql);

    console.log(`✅ Connected!\n`);
    console.log(`📚 Seeding ${CATHOLIC_BOOKS.length} books...\n`);

    // Clear existing books (optional - uncomment to reset)
    // await db.delete(books);
    // console.log("🗑️  Cleared existing books\n");

    let successCount = 0;
    let skipCount = 0;

    for (const book of CATHOLIC_BOOKS) {
      try {
        await db.insert(books).values({
          name: book.name,
          amharicName: book.amharicName,
          chapters: book.chapters,
          section: book.section,
        });
        
        console.log(`✅ [${successCount + skipCount + 1}/${CATHOLIC_BOOKS.length}] ${book.name.padEnd(25)} (${book.amharicName.padEnd(20)}) - ${book.chapters} chapters [${book.section}]`);
        successCount++;
      } catch (error: any) {
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          console.log(`⏭️  [${successCount + skipCount + 1}/${CATHOLIC_BOOKS.length}] ${book.name.padEnd(25)} (already exists)`);
          skipCount++;
        } else {
          console.error(`❌ [${successCount + skipCount + 1}/${CATHOLIC_BOOKS.length}] ${book.name}: ${error.message}`);
        }
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 SEEDING RESULTS");
    console.log("=".repeat(80));
    console.log(`✅ Successfully inserted: ${successCount} books`);
    console.log(`⏭️  Skipped (already exist): ${skipCount} books`);
    console.log(`📚 Total in database: ${successCount + skipCount} books`);
    console.log("=".repeat(80) + "\n");

    console.log("✨ SUCCESS! Your Bible books are now in the Neon database!\n");
    console.log("📝 Next steps:");
    console.log("   1. Verify in Drizzle Studio: pnpm db:studio");
    console.log("   2. Seed chapters: pnpm seed:all");
    console.log("   3. View in app: pnpm dev\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ SEEDING FAILED:", error);
    process.exit(1);
  }
}

seedBooks();
