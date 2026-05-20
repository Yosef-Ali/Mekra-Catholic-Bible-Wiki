import fs from 'fs';

const INPUT_FILE = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/amharic_bible_extracted.txt';

const patterns = [
  'ወደ ቆሮንቶስ ሰዎች',
  'ወደ ተሰሎንቄ ሰዎች',
  'ወደ ጢሞቴዎስ',
  'የጴጥሮስ መልእክት',
  'የዮሐንስ መልእክት',
  'የጌታችን የኢየሱስ ክርስቶስ ወንጌል', // Matthew
  'የያዕቆብ መልእክት'
];

const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
const lines = fileContent.split('\n');

console.log('Scanning for alternative titles...\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  for (const pattern of patterns) {
    if (line.includes(pattern)) {
      console.log(`Line ${i + 1}: ${line}`);
    }
  }
}
