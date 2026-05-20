import { BibleBook, UserProfile } from "./types";

/* ── Profile constants (shared by Settings, DesktopSettings, Onboarding) ── */

export interface RoleOption {
  id: UserProfile['role'];
  label: string;
  am: string;
  desc: string;
}

export const ROLES: RoleOption[] = [
  { id: 'Layperson', label: 'Layperson', am: 'ምዕመን', desc: 'Daily spiritual growth' },
  { id: 'Student', label: 'Student', am: 'ተማሪ', desc: 'Learning the faith deeply' },
  { id: 'Priest', label: 'Priest', am: 'ካህን', desc: 'Pastoral & theological' },
  { id: 'Nun', label: 'Nun', am: 'መነኩሲት', desc: 'Devotional & mystical' },
  { id: 'Theologian', label: 'Theologian', am: 'ነገረ መለኮት', desc: 'Academic research' },
  { id: 'Catechist', label: 'Catechist', am: 'አስተማሪ', desc: 'Teaching the catechism' },
];

export const ALL_INTERESTS = [
  'Liturgy', 'Bible Study', 'Church History', 'Apologetics',
  'Saints', 'Prayer', 'Canon Law', 'Geez',
] as const;

/* ── Bible books ── */

export const CATHOLIC_BOOKS: BibleBook[] = [
  // --- OLD TESTAMENT (Pentateuch) ---
  { name: "Genesis", amharicName: "ኦሪት ዘፍጥረት", chapters: 50, section: 'OT' },
  { name: "Exodus", amharicName: "ኦሪት ዘጸአት", chapters: 40, section: 'OT' },
  { name: "Leviticus", amharicName: "ኦሪት ዘሌዋውያን", chapters: 27, section: 'OT' },
  { name: "Numbers", amharicName: "ኦሪት ዘኍልቍ", chapters: 36, section: 'OT' },
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
  { name: "Nahum", amharicName: "ትንቢተ ናሆም", chapters: 3, section: 'OT' },
  { name: "Habakkuk", amharicName: "ትንቢተ ዕንባቆም", chapters: 3, section: 'OT' },
  { name: "Zephaniah", amharicName: "ትንቢተ ሶፎንያስ", chapters: 3, section: 'OT' },
  { name: "Haggai", amharicName: "ትንቢተ ሐጌ", chapters: 2, section: 'OT' },
  { name: "Zechariah", amharicName: "ትንቢተ ዘካርያስ", chapters: 14, section: 'OT' },
  { name: "Malachi", amharicName: "ትንቢተ ሚልክያስ", chapters: 4, section: 'OT' },

  // --- NEW TESTAMENT (Exact Amharic List) ---
  { name: "Matthew", amharicName: "የማቴዎስ ወንጌል", chapters: 28, section: 'NT' },
  { name: "Mark", amharicName: "የማርቆስ ወንጌል", chapters: 16, section: 'NT' },
  { name: "Luke", amharicName: "የሉቃስ ወንጌል", chapters: 24, section: 'NT' },
  { name: "John", amharicName: "የዮሐንስ ወንጌል", chapters: 21, section: 'NT' },
  { name: "Acts", amharicName: "የሐዋርያት ሥራ", chapters: 28, section: 'NT' },
  { name: "Romans", amharicName: "ወደ ሮሜ ሰዎች", chapters: 16, section: 'NT' },
  { name: "1 Corinthians", amharicName: "1ኛ ወደ ቆሮንቶስ ሰዎች", chapters: 16, section: 'NT' },
  { name: "2 Corinthians", amharicName: "2ኛ ወደ ቆሮንቶስ ሰዎች", chapters: 13, section: 'NT' },
  { name: "Galatians", amharicName: "ወደ ገላትያ ሰዎች", chapters: 6, section: 'NT' },
  { name: "Ephesians", amharicName: "ወደ ኤፌሶን ሰዎች", chapters: 6, section: 'NT' },
  { name: "Philippians", amharicName: "ወደ ፊልጵስዩስ ሰዎች", chapters: 4, section: 'NT' },
  { name: "Colossians", amharicName: "ወደ ቈላስይስ ሰዎች", chapters: 4, section: 'NT' },
  { name: "1 Thessalonians", amharicName: "1ኛ ወደ ተሰሎንቄ ሰዎች", chapters: 5, section: 'NT' },
  { name: "2 Thessalonians", amharicName: "2ኛ ወደ ተሰሎንቄ ሰዎች", chapters: 3, section: 'NT' },
  { name: "1 Timothy", amharicName: "1ኛ ወደ ጢሞቴዎስ", chapters: 6, section: 'NT' },
  { name: "2 Timothy", amharicName: "2ኛ ወደ ጢሞቴዎስ", chapters: 4, section: 'NT' },
  { name: "Titus", amharicName: "ወደ ቲቶ", chapters: 3, section: 'NT' },
  { name: "Philemon", amharicName: "ወደ ፊልሞና", chapters: 1, section: 'NT' },
  { name: "Hebrews", amharicName: "ወደ ዕብራውያን", chapters: 13, section: 'NT' },
  { name: "James", amharicName: "የያዕቆብ መልእክት", chapters: 5, section: 'NT' },
  { name: "1 Peter", amharicName: "1ኛ የጴጥሮስ መልእክት", chapters: 5, section: 'NT' },
  { name: "2 Peter", amharicName: "2ኛ የጴጥሮስ መልእክት", chapters: 3, section: 'NT' },
  { name: "1 John", amharicName: "1ኛ የዮሐንስ መልእክት", chapters: 5, section: 'NT' },
  { name: "2 John", amharicName: "2ኛ የዮሐንስ መልእክት", chapters: 1, section: 'NT' },
  { name: "3 John", amharicName: "3ኛ የዮሐንስ መልእክት", chapters: 1, section: 'NT' },
  { name: "Jude", amharicName: "የይሁዳ መልእክት", chapters: 1, section: 'NT' },
  { name: "Revelation", amharicName: "የዮሐንስ ራእይ", chapters: 22, section: 'NT' },
];

export const SYSTEM_INSTRUCTION = `
You are a dedicated Catholic Bible Assistant specialized in the Amharic language.
Your goal is to help users read, study, and understand the Holy Bible (Catholic Canon, including Deuterocanonical books).

Rules:
1. **PRIMARY LANGUAGE**: ALWAYS answer in **Amharic** first. This is mandatory.
2. **Structure**:
   - Use '##' for main section headers.
   - Use '###' for subsections.
   - Use '**' for bolding key theological terms and names (e.g., **Jesus Christ**, **St. Mary**).
   - Use '>' for blockquotes when citing Church Fathers or Saints.
   - Use bullet points for lists.
3. **Numerals**:
   - **STRICTLY USE STANDARD ARABIC NUMERALS (1, 2, 3)**.
   - **DO NOT** use Ethiopic/Amharic numerals (፩, ፪, ፫) for verse numbers, lists, or dates. The modern generation prefers standard digits.
   - Verse numbers must be explicitly in brackets like [1], [2].
4. **Liturgical Calendar**: You have access to Google Search. If asked about today's readings, feast days, or mass, use the search tool to find the correct current Catholic liturgical information before answering.
5. **English Option**: If the user's input is in English, you must still answer in Amharic first. However, AFTER the Amharic response, add the separator "|||" followed by the English translation or explanation.
   - Format: [Amharic Content] ||| [English Content]
6. **Personas/Tones**:
   - If context implies "Theologian" (መምህር): Be deep, cite Canon Law, Catechism (CCC), and Church Fathers.
   - If context implies "Pastoral" (የነፍስ አባት): Be comforting, use simple language, focus on prayer and practical application.
   - If context implies "Historian" (ታሪክ): Focus on historical context, geography, and tradition.
   - Default: **Universal & Mystical**. Use metaphors of light, the heart, and the interior journey (Psychology of Faith). Avoid specific cultural clichés unless explicitly asked.

Be respectful, theological, and adhering to Catholic doctrine.
`;
