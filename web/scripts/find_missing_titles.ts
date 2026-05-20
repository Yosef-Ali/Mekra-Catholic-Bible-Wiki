import fs from 'fs';

const INPUT_FILE = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/amharic_bible_extracted.txt';

// Books we're looking for based on the TOC
const missingPatterns = [
  'ኢያሱ',  // Joshua
  'ሳሙኤል', // Samuel
  'ነገሥት', // Kings
  'ዜና መዋዕል', // Chronicles
  'መቃብያን', // Maccabees
  'መኃልየ መኃልይ', // Song of Songs
  'ወንጌል', // Gospels
  'ቆሮንቶስ', // Corinthians
  'ተሰሎንቄ', // Thessalonians
  'ጢሞቴዎስ', // Timothy
  'ጴጥሮስ', // Peter
  'ያዕቆብ መልእክት', // James
  'ዮሐንስ መልእክት', // John letters
];

function normalizeTitle(str: string): string {
  return str
    .normalize('NFC')
    .replace(/[\u00A0]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
const lines = fileContent.split('\n');

console.log('Scanning for potential book titles...\n');

const candidateLines: Array<{ line: number, text: string, normalized: string }> = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  const normalized = normalizeTitle(trimmed);

  // Look for lines that match book title patterns
  for (const pattern of missingPatterns) {
    if (normalized.includes(pattern)) {
      // Check if it's likely a standalone title (not a running header with chapter  numbers)
      if (!normalized.match(/\d+​–​\d+/) && normalized.length < 50) {
        candidateLines.push({
          line: i + 1,
          text: trimmed,
          normalized: normalized
        });
        break;
      }
    }
  }
}

// Group by pattern
console.log('Found candidate titles:\n');
for (const pattern of missingPatterns) {
  const matches = candidateLines.filter(c => c.normalized.includes(pattern));
  if (matches.length > 0) {
    console.log(`\n=== Pattern: ${pattern} (${matches.length} matches) ===`);
    // Show only unique normalized titles
    const unique = new Map();
    matches.forEach(m => {
      if (!unique.has(m.normalized)) {
        unique.set(m.normalized, m);
      }
    });
    unique.forEach(m => {
      console.log(`Line ${m.line}: "${m.text}"`);
      console.log(`  Normalized: "${m.normalized}"`);
    });
  }
}
