
import fs from 'fs';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
// Or just try require if I could, but in module... 
// Let's try the default export again but maybe the type defs are wrong.
// Actually, let's just use createRequire
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');


const PDF_PATH = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';

async function findBookPages() {
  try {
    const dataBuffer = fs.readFileSync(PDF_PATH);

    let wisdomPages: number[] = [];
    let sirachPages: number[] = [];
    let numbersPages: number[] = [];

    // @ts-ignore
    await pdf(dataBuffer, {
      pagerender: function (pageData: any) {
        // This is called for each page
        return pageData.getTextContent().then(function (textContent: any) {
          let lastY, text = '';
          for (let item of textContent.items) {
            if (lastY == item.transform[5] || !lastY) {
              text += item.str;
            }
            else {
              text += '\n' + item.str;
            }
            lastY = item.transform[5];
          }

          // Simple checks
          if (text.includes("መጽሐፈ ጥበብ")) {
            // console.log(`Found Wisdom on page index idk`); // pdf-parse doesn't expose page index here easily 
            // Actually it does not pass page index to render callback well?
            // But wait, the main promise returns 'text', we can't easily correlate.
            // Let's rely on a simpler method: pdf-parse usually dumps text in order.
          }
          return text;
        });
      }
    });

    // Since pdf-parse is hard to use for per-page without heavy lifting...
    // Let's try 'pdf-lib' which I already have!
    // I can load the doc and get text? No, pdf-lib doesn't extract text easily.

    // Backtrack: Use 'pdf-parse' normal output but split by Page Feed character if it exists?
    // Actually, pdf-parse documentation says it separates pages with \n\n usually.

    // Let's just use the `max` option to parse page by page in a loop? No that's slow.

    // Alternative: Use a known library 'pdf-parse' but just dump everything and guess?
    // NO.

    // Let's use the 'render_page' option correctly. It IS possible to get page info?
    // Actually, let's just use the original plan: brute force text search might not give page numbers...

    // OK, I'll write a new script using 'pdfjs-dist' if available? No.

    // Let's try this: Just run a loop calling 'pdf' with 'max: 1' and passing different ranges? 
    // No, pdf-parse doesn't support ranges on input buffer easily.

    // Let's use the `version` I have.
    // I will try to use `pdf-parse` with a custom pagerender that *throws* or logs the page number.
    // Wait, how do I know the page number in the callback? valid question.

    // Let's use a simpler heuristic. I will Search for "Wisdom" in the *first 1000 pages* by just checking if I can see it in a chunks?

    // BETTER: Use my `extract_bible_vision.ts` to just *peek* at pages?
    // I can write a script that loops through pages 500-1000 (roughly where Wisdom should be) and checks for the title using a cheap regex on the raw PDF text if possible?

    // No, I'll just use the `find_book_pages_simple.ts` to print the *entire text* with page delimiters and I'll count them? Use `pdf-parse` default behavior.
    // The default behavior joins pages with `\n\n`.

    const data = await pdf(dataBuffer, {
      pagerender: function (pageData: any) {
        return pageData.getTextContent().then(function (textContent: any) {
          let pageText = "";
          for (let item of textContent.items) {
            pageText += item.str + " ";
          }
          // Hack: Embed page number in the text stream
          return `[[PAGE_${pageData.pageIndex}]]` + pageText;
        });
      }
    });

    // Now Regex the full text!
    const fullText = data.text;

    // Search for Wisdom
    const wRegex = /\[\[PAGE_(\d+)\]\].*?መጽሐፈ ጥበብ/g;
    let match;
    console.log("--- WISDOM (መጽሐፈ ጥበብ) ---");
    while ((match = wRegex.exec(fullText)) !== null) {
      // Limited output
      if (match.index > 0) { // just finding first few
        // Page index is 0-based? usually text content pageIndex is obvious
        // pdf.js pageIndex is 0-based.
        console.log(`Found on Page Index: ${match[1]}`);
      }
    }

    // Search for Sirach
    const sRegex = /\[\[PAGE_(\d+)\]\].*?መጽሐፈ ሲራክ/g;
    console.log("--- SIRACH (መጽሐፈ ሲራክ) ---");
    while ((match = sRegex.exec(fullText)) !== null) {
      console.log(`Found on Page Index: ${match[1]}`);
    }

  } catch (error) {
    console.error("Error parsing PDF:", error);
  }
}

findBookPages();
