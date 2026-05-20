
const fs = require('fs');
// @ts-ignore
const pdf = require('pdf-parse');

const PDF_PATH = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';

async function main() {
  try {
    console.log("Reading PDF...");
    const dataBuffer = fs.readFileSync(PDF_PATH);

    console.log("Parsing PDF Text...");
    const data = await pdf(dataBuffer);

    console.log(`Parsed ${data.numpages} pages.`);
    console.log(`Text length: ${data.text.length}`);

    fs.writeFileSync('full_bible_text.txt', data.text);
    console.log("Saved to full_bible_text.txt");

  } catch (e) {
    console.error("Error:", e);
  }
}

main();
