import fs from 'fs';
import path from 'path';

const filePath = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/formatted_books/23_Psalms_Amharic.txt';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split(/\r?\n|\r/);

console.log('Total lines (properly split):', lines.length);

let foundChapter1 = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].replace(/\u00A0/g, ' ').trim();
  if (!line) continue;

  if (line.includes('መዝሙር 1') || line.match(/^(?:ምዕራፍ|መዝሙር)\s+1\b/)) {
    console.log(`Found Chapter 1 at line ${i + 1}: "${line}"`);
    foundChapter1 = true;
  }
}

if (!foundChapter1) {
  console.log('Chapter 1 NOT found.');
}

// Print first 20 lines to see structure
console.log('--- First 20 Lines ---');
for (let i = 0; i < 20; i++) {
  console.log(`Line ${i + 1}: "${lines[i]}"`);
}
