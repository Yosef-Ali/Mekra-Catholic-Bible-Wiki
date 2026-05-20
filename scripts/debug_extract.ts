
import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

const PDF_PATH = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/The Amharic Bible - eBook Quality.pdf';

async function main() {
  try {
    console.log("Reading file...");
    const buf = fs.readFileSync(PDF_PATH);
    console.log(`Read ${buf.length} bytes.`);

    console.log("Loading PDF...");
    const doc = await PDFDocument.load(buf);
    console.log(`✅ Loaded! Page count: ${doc.getPageCount()}`);
  } catch (e) {
    console.error("❌ Error:", e);
  }
}

main();
