
const fs = require('fs');
const pdf = require('pdf-parse');

const PDF_PATH = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';

async function main() {
  try {
    if (!fs.existsSync(PDF_PATH)) {
      console.error("PDF not found at", PDF_PATH);
      return;
    }
    const dataBuffer = fs.readFileSync(PDF_PATH);

    // Use the pagerender option to get text per page
    const options = {
      pagerender: function (pageData) {
        return pageData.getTextContent().then(function (textContent) {
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
          // Insert a page marker
          return `[[PAGE_${pageData.pageIndex}]]\n` + text;
        });
      }
    };

    console.log('pdf import type:', typeof pdf);
    console.log('pdf import keys:', Object.keys(pdf));

    // If pdf is an object with default, use that
    const parse = typeof pdf === 'function' ? pdf : pdf.default;

    if (typeof parse !== 'function') {
      throw new Error(`pdf-parse export is not a function: ${typeof pdf}`);
    }

    const data = await parse(dataBuffer, options);
    const fullText = data.text;

    console.log(`Total Pages: ${data.numpages}`);

    const wisdomMatches = [];
    const sirachMatches = [];

    const wRegex = /\[\[PAGE_(\d+)\]\][\s\S]*?መጽሐፈ ጥበብ/g;
    let match;
    while ((match = wRegex.exec(fullText)) !== null) {
      wisdomMatches.push(match[1]);
    }

    const sRegex = /\[\[PAGE_(\d+)\]\][\s\S]*?መጽሐፈ ሲራክ/g;
    while ((match = sRegex.exec(fullText)) !== null) {
      sirachMatches.push(match[1]);
    }

    console.log("Possible Wisdom Pages:", wisdomMatches.slice(0, 5));
    console.log("Possible Sirach Pages:", sirachMatches.slice(0, 5));

  } catch (e) {
    console.error(e);
  }
}

main();
