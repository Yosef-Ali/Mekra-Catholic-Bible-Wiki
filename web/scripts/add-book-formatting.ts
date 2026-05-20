/**
 * Add subtitles and paragraph breaks for books missing formatting
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

type ChapterFormat = {
  subtitles?: { verse: number; text: string }[];
  paragraphs?: number[];
};

// Exodus (148) - remaining chapters
const exodusFormat: Record<number, ChapterFormat> = {
  1: { subtitles: [{ verse: 1, text: 'እስራኤላውያን በግብፅ' }, { verse: 8, text: 'እስራኤላውያን መገፋታቸው' }], paragraphs: [1, 8, 15, 22] },
  2: { subtitles: [{ verse: 1, text: 'የሙሴ ልደት' }, { verse: 11, text: 'ሙሴ ወደ ምድያም መሸሹ' }], paragraphs: [1, 11, 16, 23] },
  3: { subtitles: [{ verse: 1, text: 'የሚነድ ቁጥቋጦ' }], paragraphs: [1, 7, 13] },
  4: { subtitles: [{ verse: 1, text: 'ለሙሴ የተሰጡ ምልክቶች' }, { verse: 18, text: 'ሙሴ ወደ ግብፅ መመለሱ' }], paragraphs: [1, 10, 18, 27] },
  5: { subtitles: [{ verse: 1, text: 'ሙሴና አሮን በፈርዖን ፊት' }], paragraphs: [1, 6, 15, 22] },
  6: { subtitles: [{ verse: 1, text: 'እግዚአብሔር ለሙሴ የሰጠው ተስፋ' }, { verse: 14, text: 'የሙሴና የአሮን የትውልድ ሐረግ' }], paragraphs: [1, 10, 14, 28] },
  13: { subtitles: [{ verse: 1, text: 'የበኲራት ቅድስና' }, { verse: 17, text: 'ከግብፅ መውጣት' }], paragraphs: [1, 11, 17] },
  14: { subtitles: [{ verse: 1, text: 'ቀይ ባሕርን መሻገር' }], paragraphs: [1, 10, 19, 26] },
  15: { subtitles: [{ verse: 1, text: 'የሙሴ መዝሙር' }, { verse: 22, text: 'መራራ ውኃ' }], paragraphs: [1, 19, 22] },
  16: { subtitles: [{ verse: 1, text: 'መና እና የሴማ ወፍ' }], paragraphs: [1, 9, 16, 31] },
  17: { subtitles: [{ verse: 1, text: 'ከዐለት የፈለቀ ውኃ' }, { verse: 8, text: 'ከአማሌቃውያን ጋር ጦርነት' }], paragraphs: [1, 8] },
  18: { subtitles: [{ verse: 1, text: 'ዮቶር ሙሴን መጎብኘቱ' }], paragraphs: [1, 13, 24] },
  19: { subtitles: [{ verse: 1, text: 'በሲና ተራራ' }], paragraphs: [1, 9, 16] },
  20: { subtitles: [{ verse: 1, text: 'ዐሥርቱ ትእዛዛት' }, { verse: 22, text: 'ስለ መሠዊያ' }], paragraphs: [1, 18, 22] },
  21: { subtitles: [{ verse: 1, text: 'ስለ ባሪያዎች' }, { verse: 12, text: 'ስለ ግድያ' }], paragraphs: [1, 12, 18, 28] },
  22: { subtitles: [{ verse: 1, text: 'ስለ ንብረት' }, { verse: 16, text: 'ልዩ ልዩ ሕጎች' }], paragraphs: [1, 16, 25] },
  23: { subtitles: [{ verse: 1, text: 'ስለ ፍትሕ' }, { verse: 10, text: 'የሰንበትና የበዓል ሕጎች' }, { verse: 20, text: 'የእግዚአብሔር ተስፋ' }], paragraphs: [1, 10, 20] },
  24: { subtitles: [{ verse: 1, text: 'ቃል ኪዳኑ መጽደቁ' }, { verse: 12, text: 'ሙሴ በተራራው ላይ' }], paragraphs: [1, 9, 12] },
  25: { subtitles: [{ verse: 1, text: 'የድንኳኑ እቃዎች' }], paragraphs: [1, 10, 23, 31] },
  26: { subtitles: [{ verse: 1, text: 'የመገናኛው ድንኳን' }], paragraphs: [1, 7, 15, 31] },
  27: { subtitles: [{ verse: 1, text: 'የመሠዊያው ቅጥር' }], paragraphs: [1, 9, 20] },
  28: { subtitles: [{ verse: 1, text: 'የካህናት ልብስ' }], paragraphs: [1, 15, 31] },
  29: { subtitles: [{ verse: 1, text: 'የካህናት ሹመት ሥርዓት' }], paragraphs: [1, 19, 38] },
  30: { subtitles: [{ verse: 1, text: 'የዕጣን መሠዊያ' }, { verse: 11, text: 'የቈጠራ ገንዘብ' }], paragraphs: [1, 11, 17, 22, 34] },
  31: { subtitles: [{ verse: 1, text: 'የተመረጡ የእጅ ሥራ ባለሙያዎች' }, { verse: 12, text: 'የሰንበት ሕግ' }], paragraphs: [1, 12, 18] },
  32: { subtitles: [{ verse: 1, text: 'የወርቅ ጥጃ' }, { verse: 15, text: 'የሙሴ ቁጣ' }], paragraphs: [1, 15, 25, 30] },
  33: { subtitles: [{ verse: 1, text: 'ከሲና መነሳት' }, { verse: 7, text: 'የመገናኛው ድንኳን' }], paragraphs: [1, 7, 12, 18] },
  34: { subtitles: [{ verse: 1, text: 'አዲስ የድንጋይ ጽላቶች' }, { verse: 10, text: 'ቃል ኪዳኑ መታደሱ' }], paragraphs: [1, 10, 18, 29] },
  35: { subtitles: [{ verse: 1, text: 'የሰንበት ደንብ' }, { verse: 4, text: 'ለድንኳኑ መባ' }], paragraphs: [1, 4, 20, 30] },
  36: { subtitles: [{ verse: 1, text: 'የድንኳኑ ግንባታ' }], paragraphs: [1, 8, 14, 31] },
  37: { subtitles: [{ verse: 1, text: 'የቃል ኪዳኑ ታቦት' }], paragraphs: [1, 10, 17, 25] },
  38: { subtitles: [{ verse: 1, text: 'የመሠዊያው ግንባታ' }], paragraphs: [1, 8, 21] },
  39: { subtitles: [{ verse: 1, text: 'የካህናት ልብስ' }], paragraphs: [1, 8, 22, 32] },
};

// Job (168)
const jobFormat: Record<number, ChapterFormat> = {
  1: { subtitles: [{ verse: 1, text: 'የኢዮብ ሕይወት' }, { verse: 6, text: 'የኢዮብ ፈተና' }], paragraphs: [1, 6, 13, 20] },
  2: { subtitles: [{ verse: 1, text: 'ሁለተኛው ፈተና' }, { verse: 11, text: 'የኢዮብ ሦስቱ ወዳጆች' }], paragraphs: [1, 7, 11] },
  3: { subtitles: [{ verse: 1, text: 'የኢዮብ ሐዘን' }], paragraphs: [1, 11, 20] },
  38: { subtitles: [{ verse: 1, text: 'እግዚአብሔር ኢዮብን መመለሱ' }], paragraphs: [1, 12, 25, 39] },
  42: { subtitles: [{ verse: 1, text: 'የኢዮብ ንስሐ' }, { verse: 7, text: 'የኢዮብ መልሶ መቋቋም' }], paragraphs: [1, 7, 10] },
};

// Proverbs (170)
const proverbsFormat: Record<number, ChapterFormat> = {
  1: { subtitles: [{ verse: 1, text: 'መግቢያ' }, { verse: 8, text: 'ስለ ጥበብ' }], paragraphs: [1, 8, 20] },
  8: { subtitles: [{ verse: 1, text: 'ጥበብ ትጣራለች' }], paragraphs: [1, 12, 22, 32] },
  31: { subtitles: [{ verse: 1, text: 'የልሙኤል ቃል' }, { verse: 10, text: 'ብርቱ ሚስት' }], paragraphs: [1, 10] },
};

// Psalms - add for all chapters
const psalmsFormat: Record<number, ChapterFormat> = {};
for (let i = 1; i <= 150; i++) {
  psalmsFormat[i] = { paragraphs: [1] };
}

// Matthew (193) - remaining
const matthewFormat: Record<number, ChapterFormat> = {
  4: { subtitles: [{ verse: 1, text: 'የኢየሱስ ፈተና' }, { verse: 12, text: 'ኢየሱስ አገልግሎቱን መጀመሩ' }], paragraphs: [1, 12, 18] },
  6: { subtitles: [{ verse: 1, text: 'ስለ ምጽዋት' }, { verse: 5, text: 'ስለ ጸሎት' }, { verse: 16, text: 'ስለ ጾም' }, { verse: 19, text: 'ስለ ሀብት' }], paragraphs: [1, 5, 16, 19, 25] },
  7: { subtitles: [{ verse: 1, text: 'ስለ መፍረድ' }, { verse: 7, text: 'ለምኑ ይሰጣችኋል' }, { verse: 13, text: 'ጠባቡ በር' }], paragraphs: [1, 7, 13, 21, 24] },
  8: { subtitles: [{ verse: 1, text: 'ኢየሱስ ለምጻሙን ፈወሰ' }, { verse: 5, text: 'የመቶ አለቃ እምነት' }, { verse: 14, text: 'ብዙ በሽተኞች ፈውስ' }], paragraphs: [1, 5, 14, 18, 23, 28] },
  9: { subtitles: [{ verse: 1, text: 'ሽባውን መፈወስ' }, { verse: 9, text: 'የማቴዎስ መጠራት' }, { verse: 18, text: 'ሴት ልጅ መነሣት' }], paragraphs: [1, 9, 14, 18, 27, 35] },
  10: { subtitles: [{ verse: 1, text: 'ዐሥራ ሁለቱ ሐዋርያት' }, { verse: 16, text: 'መከራ እንደሚመጣ' }], paragraphs: [1, 16, 26, 34] },
  13: { subtitles: [{ verse: 1, text: 'የዘሪ ምሳሌ' }, { verse: 24, text: 'የእንክርዳድ ምሳሌ' }, { verse: 31, text: 'የሰናፍጭ ቅንጣት ምሳሌ' }], paragraphs: [1, 10, 24, 31, 36, 44, 53] },
  14: { subtitles: [{ verse: 1, text: 'የመጥምቁ ዮሐንስ ሞት' }, { verse: 13, text: 'አምስት ሺህ ሰዎች መመገብ' }, { verse: 22, text: 'ኢየሱስ በውኃ ላይ መሄዱ' }], paragraphs: [1, 13, 22, 34] },
  16: { subtitles: [{ verse: 1, text: 'ፈሪሳውያን ምልክት መፈለጋቸው' }, { verse: 13, text: 'የጴጥሮስ ምስክርነት' }, { verse: 21, text: 'ኢየሱስ ስለ ሞቱ መናገሩ' }], paragraphs: [1, 5, 13, 21] },
  17: { subtitles: [{ verse: 1, text: 'መለወጥ' }, { verse: 14, text: 'ጋኔን ያደረበትን ልጅ መፈወስ' }], paragraphs: [1, 14, 22] },
  18: { subtitles: [{ verse: 1, text: 'ታላቅ ማን ነው?' }, { verse: 10, text: 'የጠፋ በግ ምሳሌ' }, { verse: 21, text: 'ስለ ይቅርታ' }], paragraphs: [1, 10, 15, 21] },
  19: { subtitles: [{ verse: 1, text: 'ስለ ፍች' }, { verse: 13, text: 'ኢየሱስና ሕፃናት' }, { verse: 16, text: 'ባለጸጋው ወጣት' }], paragraphs: [1, 13, 16, 23] },
  20: { subtitles: [{ verse: 1, text: 'የወይን ቦታ ሠራተኞች ምሳሌ' }, { verse: 17, text: 'ኢየሱስ ስለ ሞቱ' }, { verse: 29, text: 'ሁለት ዕውሮች ፈውስ' }], paragraphs: [1, 17, 20, 29] },
  21: { subtitles: [{ verse: 1, text: 'ወደ ኢየሩሳሌም መግባት' }, { verse: 12, text: 'ቤተ መቅደስን ማጽዳት' }, { verse: 23, text: 'የኢየሱስ ሥልጣን' }], paragraphs: [1, 12, 18, 23, 28, 33] },
  22: { subtitles: [{ verse: 1, text: 'የሠርግ ግብዣ ምሳሌ' }, { verse: 15, text: 'ለቄሣር ግብር መክፈል' }, { verse: 23, text: 'ስለ ትንሣኤ' }], paragraphs: [1, 15, 23, 34, 41] },
  23: { subtitles: [{ verse: 1, text: 'ኢየሱስ ጻፎችንና ፈሪሳውያንን መገሰጹ' }], paragraphs: [1, 13, 23, 29, 37] },
  24: { subtitles: [{ verse: 1, text: 'የዘመን መጨረሻ ምልክቶች' }, { verse: 29, text: 'የሰው ልጅ መምጣት' }, { verse: 36, text: 'ነቅተን መጠበቅ' }], paragraphs: [1, 15, 29, 36, 45] },
  25: { subtitles: [{ verse: 1, text: 'የዐሥሩ ደናግል ምሳሌ' }, { verse: 14, text: 'የመክሊቶች ምሳሌ' }, { verse: 31, text: 'የመጨረሻው ፍርድ' }], paragraphs: [1, 14, 31] },
  26: { subtitles: [{ verse: 1, text: 'ኢየሱስን ለመግደል ማሴር' }, { verse: 17, text: 'የፋሲካ እራት' }, { verse: 36, text: 'ጌቴሴማኒ' }, { verse: 57, text: 'በሸንጎ ፊት' }], paragraphs: [1, 14, 17, 26, 36, 47, 57, 69] },
  27: { subtitles: [{ verse: 1, text: 'ኢየሱስ ወደ ጲላጦስ መወሰዱ' }, { verse: 11, text: 'ኢየሱስ በጲላጦስ ፊት' }, { verse: 27, text: 'ስለቀስ' }, { verse: 45, text: 'የኢየሱስ ሞት' }, { verse: 57, text: 'የኢየሱስ መቀበር' }], paragraphs: [1, 11, 27, 32, 45, 57, 62] },
  28: { subtitles: [{ verse: 1, text: 'ትንሣኤ' }, { verse: 11, text: 'የጠባቂዎች ሪፖርት' }, { verse: 16, text: 'ታላቁ ተልእኮ' }], paragraphs: [1, 11, 16] },
};

// Mark (194)
const markFormat: Record<number, ChapterFormat> = {
  1: { subtitles: [{ verse: 1, text: 'የመጥምቁ ዮሐንስ ስብከት' }, { verse: 9, text: 'የኢየሱስ ጥምቀት' }, { verse: 14, text: 'አገልግሎቱን መጀመሩ' }], paragraphs: [1, 9, 14, 21, 29, 35, 40] },
  2: { subtitles: [{ verse: 1, text: 'ሽባውን መፈወስ' }, { verse: 13, text: 'ሌዊ መጠራቱ' }], paragraphs: [1, 13, 18, 23] },
  3: { subtitles: [{ verse: 1, text: 'የደረቀ እጅ ያለውን መፈወስ' }, { verse: 13, text: 'ዐሥራ ሁለቱ መመረጣቸው' }], paragraphs: [1, 7, 13, 20, 31] },
  4: { subtitles: [{ verse: 1, text: 'የዘሪ ምሳሌ' }, { verse: 21, text: 'መብራት በቁና ሥር' }, { verse: 35, text: 'ኢየሱስ አውሎ ነፋስን ማስቆሙ' }], paragraphs: [1, 10, 21, 26, 30, 35] },
  5: { subtitles: [{ verse: 1, text: 'ጋኔን የወጣለት ሰው' }, { verse: 21, text: 'የያኢሮስ ልጅ' }], paragraphs: [1, 21, 35] },
  6: { subtitles: [{ verse: 1, text: 'ኢየሱስ በናዝሬት' }, { verse: 7, text: 'ዐሥራ ሁለቱ መላካቸው' }, { verse: 14, text: 'የዮሐንስ ሞት' }, { verse: 30, text: 'አምስት ሺህ መመገብ' }], paragraphs: [1, 7, 14, 30, 45, 53] },
  7: { subtitles: [{ verse: 1, text: 'ንጽሕናና ርኵስ' }, { verse: 24, text: 'የሶሮፊንቄያዊት ሴት እምነት' }], paragraphs: [1, 14, 24, 31] },
  8: { subtitles: [{ verse: 1, text: 'አራት ሺህ መመገብ' }, { verse: 11, text: 'ፈሪሳውያን ምልክት መፈለጋቸው' }, { verse: 27, text: 'የጴጥሮስ ምስክርነት' }], paragraphs: [1, 11, 14, 22, 27, 31] },
  9: { subtitles: [{ verse: 1, text: 'መለወጥ' }, { verse: 14, text: 'ጋኔን ያደረበት ልጅ' }, { verse: 30, text: 'ኢየሱስ ስለ ሞቱ' }], paragraphs: [1, 14, 30, 33, 38, 42] },
  10: { subtitles: [{ verse: 1, text: 'ስለ ፍች' }, { verse: 13, text: 'ኢየሱስና ሕፃናት' }, { verse: 17, text: 'ባለጸጋው ወጣት' }, { verse: 32, text: 'ስለ ሞቱ ሦስተኛ ጊዜ' }], paragraphs: [1, 13, 17, 32, 35, 46] },
  11: { subtitles: [{ verse: 1, text: 'ወደ ኢየሩሳሌም መግባት' }, { verse: 12, text: 'የበለስ ዛፍ መርገም' }, { verse: 15, text: 'ቤተ መቅደስ ማጽዳት' }], paragraphs: [1, 12, 15, 20, 27] },
  12: { subtitles: [{ verse: 1, text: 'የወይን ቦታ ገበሬዎች ምሳሌ' }, { verse: 13, text: 'ለቄሣር ግብር' }, { verse: 18, text: 'ስለ ትንሣኤ' }, { verse: 28, text: 'ታላቁ ትእዛዝ' }], paragraphs: [1, 13, 18, 28, 35, 38, 41] },
  13: { subtitles: [{ verse: 1, text: 'የዘመን መጨረሻ ምልክቶች' }, { verse: 24, text: 'የሰው ልጅ መምጣት' }], paragraphs: [1, 9, 14, 24, 32] },
  14: { subtitles: [{ verse: 1, text: 'ኢየሱስን ለመግደል ማሴር' }, { verse: 12, text: 'የፋሲካ እራት' }, { verse: 32, text: 'ጌቴሴማኒ' }, { verse: 53, text: 'በሸንጎ ፊት' }], paragraphs: [1, 10, 12, 22, 32, 43, 53, 66] },
  15: { subtitles: [{ verse: 1, text: 'ኢየሱስ በጲላጦስ ፊት' }, { verse: 16, text: 'ስለቀስ' }, { verse: 33, text: 'የኢየሱስ ሞት' }, { verse: 42, text: 'መቀበር' }], paragraphs: [1, 6, 16, 21, 33, 42] },
  16: { subtitles: [{ verse: 1, text: 'ትንሣኤ' }, { verse: 9, text: 'ለመግደለና ማርያም መታየቱ' }, { verse: 14, text: 'ለደቀ መዛሙርቱ መታየቱ' }], paragraphs: [1, 9, 14, 19] },
};

// Luke (195) - remaining
const lukeFormat: Record<number, ChapterFormat> = {
  3: { subtitles: [{ verse: 1, text: 'የመጥምቁ ዮሐንስ ስብከት' }, { verse: 21, text: 'የኢየሱስ ጥምቀት' }, { verse: 23, text: 'የኢየሱስ የትውልድ ሐረግ' }], paragraphs: [1, 7, 15, 21, 23] },
  4: { subtitles: [{ verse: 1, text: 'የኢየሱስ ፈተና' }, { verse: 14, text: 'ኢየሱስ በናዝሬት' }, { verse: 31, text: 'ኢየሱስ በቅፍርናሆም' }], paragraphs: [1, 14, 31, 38, 42] },
  5: { subtitles: [{ verse: 1, text: 'የመጀመሪያዎቹ ደቀ መዛሙርት' }, { verse: 12, text: 'ለምጻሙን መፈወስ' }, { verse: 17, text: 'ሽባውን መፈወስ' }], paragraphs: [1, 12, 17, 27, 33] },
  6: { subtitles: [{ verse: 1, text: 'የሰንበት ጌታ' }, { verse: 12, text: 'ዐሥራ ሁለቱ ሐዋርያት' }, { verse: 17, text: 'ኢየሱስ አዕላፍን አስተማረ' }, { verse: 20, text: 'ብፁዓንና ወዮዎች' }], paragraphs: [1, 6, 12, 17, 20, 27, 37, 43] },
  7: { subtitles: [{ verse: 1, text: 'የመቶ አለቃ እምነት' }, { verse: 11, text: 'የመበለቲቱ ልጅ መነሣት' }, { verse: 18, text: 'ከዮሐንስ የመጡ መልእክተኞች' }, { verse: 36, text: 'ኃጢአተኛዋ ሴት' }], paragraphs: [1, 11, 18, 36] },
  8: { subtitles: [{ verse: 1, text: 'የዘሪ ምሳሌ' }, { verse: 22, text: 'አውሎ ነፋስ ማስቆም' }, { verse: 26, text: 'ጋኔን ያደረበት ሰው' }, { verse: 40, text: 'የያኢሮስ ልጅ' }], paragraphs: [1, 16, 22, 26, 40] },
  9: { subtitles: [{ verse: 1, text: 'ዐሥራ ሁለቱ መላካቸው' }, { verse: 10, text: 'አምስት ሺህ መመገብ' }, { verse: 18, text: 'የጴጥሮስ ምስክርነት' }, { verse: 28, text: 'መለወጥ' }], paragraphs: [1, 10, 18, 28, 37, 43, 46, 51, 57] },
  10: { subtitles: [{ verse: 1, text: 'ሰባ ሁለቱ መላካቸው' }, { verse: 25, text: 'ቸር ሳምራዊ' }, { verse: 38, text: 'ማርታና ማርያም' }], paragraphs: [1, 17, 25, 38] },
};

// John (196) - mostly already has, add remaining
const johnFormat: Record<number, ChapterFormat> = {
  2: { subtitles: [{ verse: 1, text: 'በቃና የነበረ ሠርግ' }, { verse: 13, text: 'ቤተ መቅደስን ማጽዳት' }], paragraphs: [1, 13, 23] },
  4: { subtitles: [{ verse: 1, text: 'ኢየሱስና ሳምራዊቷ ሴት' }, { verse: 43, text: 'የንጉሥ ባለሟል ልጅ' }], paragraphs: [1, 27, 39, 43] },
  5: { subtitles: [{ verse: 1, text: 'በቤተ ሳይዳ ፈውስ' }, { verse: 16, text: 'ስለ አብ ምስክርነት' }], paragraphs: [1, 16, 31, 36] },
  6: { subtitles: [{ verse: 1, text: 'አምስት ሺህ መመገብ' }, { verse: 16, text: 'በውኃ ላይ መሄድ' }, { verse: 25, text: 'የሕይወት እንጀራ' }], paragraphs: [1, 16, 25, 41, 52, 60, 66] },
  7: { subtitles: [{ verse: 1, text: 'ኢየሱስ ወደ ዳስ በዓል' }, { verse: 14, text: 'ኢየሱስ በበዓሉ አስተማረ' }], paragraphs: [1, 14, 25, 37, 45] },
  8: { subtitles: [{ verse: 1, text: 'ኢየሱስና በዝሙት የተያዘች ሴት' }, { verse: 12, text: 'የዓለም ብርሃን' }, { verse: 31, text: 'የአብርሃም ልጆች' }], paragraphs: [1, 12, 21, 31, 48] },
  9: { subtitles: [{ verse: 1, text: 'ዕውር ሆኖ የተወለደውን መፈወስ' }], paragraphs: [1, 8, 13, 24, 35] },
  10: { subtitles: [{ verse: 1, text: 'መልካሙ እረኛ' }, { verse: 22, text: 'አይሁድ ኢየሱስን አለመቀበላቸው' }], paragraphs: [1, 7, 22, 40] },
  11: { subtitles: [{ verse: 1, text: 'የአልዓዛር ሞት' }, { verse: 17, text: 'ኢየሱስ ትንሣኤና ሕይወት ነው' }, { verse: 38, text: 'ኢየሱስ አልዓዛርን አስነሣው' }], paragraphs: [1, 17, 28, 38, 45] },
  12: { subtitles: [{ verse: 1, text: 'ማርያም ኢየሱስን ቀባችው' }, { verse: 12, text: 'ወደ ኢየሩሳሌም መግባት' }], paragraphs: [1, 9, 12, 20, 27, 37, 44] },
  13: { subtitles: [{ verse: 1, text: 'ኢየሱስ የደቀ መዛሙርቱን እግር አጠበ' }, { verse: 21, text: 'ኢየሱስ አሳልፎ ሰጪውን ገለጠ' }, { verse: 31, text: 'አዲስ ትእዛዝ' }], paragraphs: [1, 12, 21, 31, 36] },
  14: { subtitles: [{ verse: 1, text: 'ኢየሱስ መንገዱ እውነቱ ሕይወቱ' }, { verse: 15, text: 'መንፈስ ቅዱስ ይመጣል' }], paragraphs: [1, 8, 15, 25] },
  15: { subtitles: [{ verse: 1, text: 'እውነተኛ የወይን ግንድ' }, { verse: 18, text: 'ዓለም ስለሚጠላ' }], paragraphs: [1, 9, 18, 26] },
  16: { subtitles: [{ verse: 1, text: 'የመንፈስ ቅዱስ ሥራ' }, { verse: 16, text: 'ኀዘን ወደ ደስታ' }], paragraphs: [1, 5, 12, 16, 25] },
  17: { subtitles: [{ verse: 1, text: 'የኢየሱስ ጸሎት' }], paragraphs: [1, 6, 13, 20] },
  18: { subtitles: [{ verse: 1, text: 'ኢየሱስ መያዙ' }, { verse: 12, text: 'ኢየሱስ በሐና ፊት' }, { verse: 28, text: 'ኢየሱስ በጲላጦስ ፊት' }], paragraphs: [1, 12, 19, 25, 28, 33, 38] },
  19: { subtitles: [{ verse: 1, text: 'ኢየሱስ ተገረፈ' }, { verse: 17, text: 'ስቅለት' }, { verse: 31, text: 'የኢየሱስ ሞት' }, { verse: 38, text: 'መቀበር' }], paragraphs: [1, 4, 12, 17, 23, 28, 31, 38] },
  20: { subtitles: [{ verse: 1, text: 'ባዶው መቃብር' }, { verse: 11, text: 'ኢየሱስ ለማርያም ተገለጠ' }, { verse: 19, text: 'ኢየሱስ ለደቀ መዛሙርቱ ተገለጠ' }], paragraphs: [1, 11, 19, 24, 30] },
  21: { subtitles: [{ verse: 1, text: 'ኢየሱስ ለሰባት ደቀ መዛሙርት ተገለጠ' }, { verse: 15, text: 'ኢየሱስና ጴጥሮስ' }], paragraphs: [1, 15, 20, 24] },
};

async function addFormats(bookId: number, formats: Record<number, ChapterFormat>, bookName: string) {
  let count = 0;
  for (const [chStr, data] of Object.entries(formats)) {
    const ch = parseInt(chStr);
    
    const [current] = await sql`
      SELECT formatting_rules FROM formatted_chapter_contents 
      WHERE book_id = ${bookId} AND chapter_number = ${ch}
    `;
    
    if (!current) continue;
    
    const rules = current.formatting_rules as any || {};
    
    // Only update if missing
    const updated = {
      ...rules,
      subtitles: data.subtitles || rules.subtitles || [],
      paragraphBreaks: data.paragraphs || rules.paragraphBreaks || []
    };
    
    await sql`
      UPDATE formatted_chapter_contents 
      SET formatting_rules = ${JSON.stringify(updated)}::jsonb
      WHERE book_id = ${bookId} AND chapter_number = ${ch}
    `;
    count++;
  }
  console.log(`✅ ${bookName}: ${count} chapters`);
}

async function main() {
  console.log('Adding formatting for multiple books...\n');
  
  await addFormats(148, exodusFormat, 'Exodus');
  await addFormats(168, jobFormat, 'Job');
  await addFormats(170, proverbsFormat, 'Proverbs');
  await addFormats(169, psalmsFormat, 'Psalms');
  await addFormats(193, matthewFormat, 'Matthew');
  await addFormats(194, markFormat, 'Mark');
  await addFormats(195, lukeFormat, 'Luke');
  await addFormats(196, johnFormat, 'John');
  
  console.log('\n✅ All done!');
}

main().catch(console.error);
