
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/extraction_output';

async function mergeChunks(bookName: string) {
  console.log(`Merge chunks for ${bookName}...`);

  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith(`${bookName}_chunk_`) && f.endsWith('.json'));

  // Sort by start page number in filename: Book_chunk_Start-End.json
  files.sort((a, b) => {
    const startA = parseInt(a.match(/chunk_(\d+)-/)?.[1] || '0');
    const startB = parseInt(b.match(/chunk_(\d+)-/)?.[1] || '0');
    return startA - startB;
  });

  let allChapters: any[] = [];

  for (const file of files) {
    const p = path.join(OUTPUT_DIR, file);
    const content = JSON.parse(fs.readFileSync(p, 'utf-8'));

    const chapters = content.chapters || (content.book && content.book.chapters) || [];

    if (chapters.length > 0) {
      // Merge logic
      if (allChapters.length > 0) {
        const lastCh = allChapters[allChapters.length - 1];
        const firstNew = chapters[0];

        if (lastCh.chapter_number === firstNew.chapter_number) {
          // Merge content
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
  console.log(`✅ Merged ${files.length} chunks into ${outPath}`);
  console.log(`Total Chapters: ${allChapters.length}`);
}

const book = process.argv[2];
if (book) mergeChunks(book);
else console.log("Usage: tsx scripts/merge_chunks.ts <BookName>");
