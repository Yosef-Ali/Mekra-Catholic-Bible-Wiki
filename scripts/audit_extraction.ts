import fs from 'fs';
import path from 'path';

const targetFile = process.argv[2] || 'Genesis_extracted.json';
const JSON_PATH = path.join(process.cwd(), 'extraction_output', targetFile);

function auditExtraction() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`❌ ${targetFile} not found at ${JSON_PATH}`);
    return;
  }

  const raw = fs.readFileSync(JSON_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const chapters = data.book.chapters;

  console.log(`📘 Book: ${data.book.book_name}`);
  console.log(`📊 Total Chapters Found: ${chapters.length}`);

  // Sort by chapter number
  chapters.sort((a: any, b: any) => a.chapter_number - b.chapter_number);

  const foundNumbers = chapters.map((c: any) => c.chapter_number);
  const missing: number[] = [];
  const maxChap = foundNumbers[foundNumbers.length - 1] || 0;

  // Estimate max chapter from data or default to 50
  const estimatedMax = foundNumbers[foundNumbers.length - 1] || 50;

  for (let i = 1; i <= estimatedMax; i++) {
    if (!foundNumbers.includes(i)) {
      missing.push(i);
    }
  }

  console.log(`✅ Chapters Present: ${foundNumbers.join(', ')}`);

  if (missing.length > 0) {
    console.log(`⚠️ MISSING CHAPTERS: ${missing.join(', ')}`);
  } else {
    console.log(`🎉 All chapters 1-${estimatedMax} present!`);
  }

  // Check content quality
  console.log('\n--- Content Quality Check ---');
  chapters.forEach((ch: any) => {
    if (!ch.content) {
      console.log(`❌ Chapter ${ch.chapter_number}: Missing Content Array`);
      return;
    }
    const verseCount = ch.content.filter((i: any) => i.type === 'verse').length;
    const headerCount = ch.content.filter((i: any) => i.type === 'chapter_header').length;

    let status = '✅';
    if (verseCount < 5) status = '⚠️ Low Verse Count';
    if (headerCount === 0) status = '⚠️ No Header';

    console.log(`Chapter ${ch.chapter_number}: ${verseCount} verses ${status}`);
  });
}

auditExtraction();
