
import fs from 'fs';
import path from 'path';

const INPUT_FILE = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/amharic_bible_extracted.txt';
const OUTPUT_FILE = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/Genesis_Amharic.txt';

// Start and end lines for Genesis based on previous analysis
// Start: Line 343 (Title "ኦሪት ዘፍጥረት")
// End: Around line 5090 (End of Chapter 50)
const START_LINE = 343;
const END_LINE_APPROX = 5200;

function processText() {
  try {
    const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
    const lines = fileContent.split('\n');

    let extractedLines: string[] = [];
    let capture = false;

    // Adjust for 0-based index
    const startIdx = START_LINE - 1;
    const endIdx = Math.min(lines.length, END_LINE_APPROX);

    for (let i = startIdx; i < endIdx; i++) {
      let line = lines[i];

      // Remove the line number prefix (e.g., "343: ")
      // The format seems to be "Number: Content" or just "Number" for empty lines sometimes?
      // Based on view_file output: "343: ኦሪት ዘፍጥረት"

      // Regex to match the line number prefix added by the tool or existing in file?
      // Wait, the view_file tool output showed "343: ...". 
      // Let's check if the actual file has line numbers or if view_file added them.
      // The view_file output said: "The following code has been modified to include a line number before every line..."
      // SO THE ACTUAL FILE DOES NOT HAVE LINE NUMBERS "343: ".
      // However, the file content itself might have page numbers or other artifacts.

      // Let's assume the file is raw text.
      // But I need to be careful. The user's prompt showed "1: ..." in the view_file output.
      // I should check the file content again without the view_file line numbers if possible, 
      // but view_file ALWAYS adds them.

      // Wait, if I read the file with fs.readFileSync, I get the RAW content.
      // The raw content likely does NOT have "343: " prefix.
      // It might have its own line numbers if it was extracted that way.

      // Let's look at the view_file output again.
      // Line 10: መጽሐፍ ቅዱስ
      // Line 82: ISBN ...
      // It seems cleanish, but might have page headers/footers.

      // I will just extract the lines as is first.
      extractedLines.push(line);

      // Check for end of Genesis
      // The next book is Exodus (Orit Ze'at).
      // If we see "ኦሪት ዘፀአት" we should stop.
      if (line.includes('ኦሪት ዘፀአት') && line.length < 50) {
        break;
      }
    }

    // Post-processing
    // 1. Remove page headers/footers if any (e.g. "ኦሪት ዘፍጥረት 1-2")
    // 2. Fix broken words (hyphenated at end of line) - this is hard without dictionary, maybe skip for now.
    // 3. Ensure paragraphs.

    const cleanedLines = extractedLines.filter(line => {
      const trimmed = line.trim();
      // Remove empty lines? Maybe keep some for structure.
      // Remove lines that look like page numbers or headers
      if (/^\d+$/.test(trimmed)) return false; // Just numbers (page numbers)
      if (trimmed.includes('ኦሪት ዘፍጥረት') && /\d+/.test(trimmed) && trimmed.length < 30) return false; // Running headers
      return true;
    });

    const finalContent = cleanedLines.join('\n');

    fs.writeFileSync(OUTPUT_FILE, finalContent);
    console.log(`Successfully wrote ${cleanedLines.length} lines to ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('Error processing file:', error);
  }
}

processText();
