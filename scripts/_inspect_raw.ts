import fs from 'fs';
import path from 'path';

// Romans 1 is around page 604 per page_map
const p = 'extraction_output/vision_page_604.json';
const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
console.log('Page 604 chapters:', d.chapters?.map((c: any) => `${c.book} ch${c.chapter} (${c.verses?.length}v)`));
const ch = d.chapters?.find((c: any) => c.chapter === 1);
if (ch) {
  console.log('First 3 verses raw:');
  ch.verses.slice(0, 3).forEach((v: any) => console.log(`  v${v.verse_number}: ${JSON.stringify(v.text.slice(0, 70))}`));
}

console.log('\n--- Revelation pages (671-700) ---');
for (const pg of [697, 698, 699, 700]) {
  const f = `extraction_output/vision_page_${pg}.json`;
  if (!fs.existsSync(f)) continue;
  const dd = JSON.parse(fs.readFileSync(f, 'utf-8'));
  console.log(`Page ${pg}:`, dd.chapters?.map((c: any) => `${c.book} ch${c.chapter} (${c.verses?.length}v)`));
}
