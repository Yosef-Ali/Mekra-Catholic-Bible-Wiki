
const fs = require('fs');
// @ts-ignore
const pdfLib = require('pdf-parse');

const PDF_PATH = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';

async function main() {
  try {
    console.log("Keys:", Object.keys(pdfLib));

    const { PDFParse } = pdfLib;

    if (!PDFParse) {
      console.error("PDFParse class not found in export.");
      return;
    }

    console.log("Reading PDF...");
    const dataBuffer = fs.readFileSync(PDF_PATH);

    // Try instantiating with data
    try {
      console.log("Attempt 1: source = buffer");
      const parser1 = new PDFParse({ source: dataBuffer, verbosity: 0 });
      const text1 = await parser1.getText();
      fs.writeFileSync('full_text.txt', text1.text);
      console.log("Success! Saved full_text.txt");
      return;
    } catch (e) {
      console.log("Attempt 1 failed:", e.message);
    }

    try {
      console.log("Attempt 2: data = buffer");
      const parser2 = new PDFParse({ data: dataBuffer, verbosity: 0 });
      const text2 = await parser2.getText();
      fs.writeFileSync('full_text.txt', text2.text);
      console.log("Success! Saved full_text.txt");
      return;
    } catch (e) {
      console.log("Attempt 2 failed:", e.message);
    }

    try {
      console.log("Attempt 3: buffer as first arg (legacy?)");
      // @ts-ignore
      const parser3 = new PDFParse(dataBuffer); // Maybe fallback?
      // But error was 'reading verbosity' from undefined options.
    } catch (e) { }


    // If it's the mehmet-kozan version, check docs/usage if possible or guess.
    // It says "pdf-to-text" in keywords.

    // Let's try using 'pdfjs-dist' directly if exposed? NO.

    // Try to 'extract text'
    if (typeof PDFParse.extractText === 'function') {
      const text = await PDFParse.extractText(dataBuffer);
      console.log(text);
    }

  } catch (e) {
    console.error("Error:", e);
  }
}

main();
