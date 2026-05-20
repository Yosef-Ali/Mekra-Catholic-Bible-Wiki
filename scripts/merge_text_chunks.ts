
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/extraction_output';

async function mergeTextChunks(bookName: string) {
  console.log(`Merging text chunks for ${bookName}...`);

  // Pattern: Book_chunk_1.json, Book_chunk_2.json ...
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith(`${bookName}_chunk_`) && f.endsWith('.json') && !f.includes('-')); // Avoid Vision chunks with dashes

  if (files.length === 0) {
    console.log("No chunks found.");
    return;
  }

  // Sort by chunk index
  files.sort((a, b) => {
    const idxA = parseInt(a.match(/chunk_(\d+)\.json/)?.[1] || '0');
    const idxB = parseInt(b.match(/chunk_(\d+)\.json/)?.[1] || '0');
    return idxA - idxB;
  });

  console.log(`Found ${files.length} chunks:`, files);

  let allChapters: any[] = [];

  for (const file of files) {
    const p = path.join(OUTPUT_DIR, file);
    const content = JSON.parse(fs.readFileSync(p, 'utf-8'));

    const chapters = content.chapters || [];

    if (chapters.length > 0) {
      if (allChapters.length > 0) {
        const lastCh = allChapters[allChapters.length - 1];
        const firstNew = chapters[0];

        if (lastCh.chapter_number === firstNew.chapter_number) {
          lastCh.content = [...lastCh.content, ...firstNew.content];
          allChapters = [...allChapters, ...chapters.slice(1)];
        } else {
          allChapters = [...allChapters, ...chapters];
        }
      } else {
        allChapters = [...allChapters, ...chapters];
      }
    }
  }

  const finalJson = {
    book: {
      book_name: bookName,
      total_chapters: allChapters.length,
      chapters: allChapters
    }
  };

  const outPath = path.join(OUTPUT_DIR, `${bookName}_extracted.json`);
  fs.writeFileSync(outPath, JSON.stringify(finalJson, null, 2));
  console.log(`✅ Merged into ${outPath}`);
  console.log(`Total Chapters: ${allChapters.length}`);
}

const book = process.argv[2];
if (book) mergeTextChunks(book);
else console.log("Usage: tsx scripts/merge_text_chunks.ts <BookName>");
