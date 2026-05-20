import fs from 'fs';
import path from 'path';

const targetFile = process.argv[2] || 'Genesis_extracted.json';
const JSON_PATH = path.join(process.cwd(), 'extraction_output', targetFile);

function repairJson() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error('❌ Genesis_extracted.json not found!');
    return;
  }

  const raw = fs.readFileSync(JSON_PATH, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON file', e);
    return;
  }

  let fixedCount = 0;

  data.book.chapters = data.book.chapters.map((ch: any) => {
    // canonical format already
    if (ch.content && Array.isArray(ch.content)) return ch;

    // Handle "sections" drift
    if (ch.sections && Array.isArray(ch.sections)) {
      console.log(`🔧 Repairing Chapter ${ch.chapter_number} (schema drift: sections)...`);
      const newContent: any[] = [];

      ch.sections.forEach((sec: any) => {
        // Add section header
        if (sec.title) {
          newContent.push({
            type: 'section_header',
            text: sec.title
          });
        }
        // Add verses
        if (sec.verses && Array.isArray(sec.verses)) {
          sec.verses.forEach((v: any) => {
            newContent.push({
              type: 'verse',
              number: v.number || parseInt(v.verse_number),
              text: v.text || v.verse_text
            });
          });
        }
      });

      fixedCount++;
      return {
        chapter_number: ch.chapter_number,
        content: newContent
      };
    }

    console.warn(`⚠️ Chapter ${ch.chapter_number} has unknown structure:`, Object.keys(ch));
    return ch;
  });

  if (fixedCount > 0) {
    fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ Repaired ${fixedCount} chapters. Saved to ${JSON_PATH}`);
  } else {
    console.log('✅ No schema repairs needed.');
  }
}

repairJson();
