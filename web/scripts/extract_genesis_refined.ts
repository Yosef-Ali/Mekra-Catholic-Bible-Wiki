
import fs from 'fs';

const INPUT_FILE = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/amharic_bible_extracted.txt';
const OUTPUT_FILE = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/Genesis_Amharic.txt';

const START_LINE = 343; // "ኦሪት ዘፍጥረት"
// End trigger: "ኦሪት ዘፀአት" or "ምዕራፍ 1" of Exodus.
// In the viewed file, line 4736 starts "ምዕራፍ 1" (of Exodus) and line 4750 is "ኦሪት ዘፀአት".
// The last verse of Genesis is 50:26 (line 4728-4730).
// We should stop before "ምዕራፍ 1" of Exodus.

function processText() {
  try {
    const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
    const lines = fileContent.split('\n');

    let extractedLines: string[] = [];

    // Adjust for 0-based index
    const startIdx = START_LINE - 1;

    for (let i = startIdx; i < lines.length; i++) {
      let line = lines[i];

      // Stop if we reach Exodus
      // The file shows "ምዕራፍ 1" followed by "መግቢያ" and then "ኦሪት ዘፀአት"
      // We want to stop after Genesis 50:26.
      // Genesis 50:26 ends around line 4730.
      // Line 4736 is "ምዕራፍ 1" (Exodus Chapter 1).
      // Let's stop if we see "ኦሪት ዘፀአት" or if we are past Genesis 50 and see "ምዕራፍ 1".

      if (line.includes('ኦሪት ዘፀአት')) {
        break;
      }

      // Also check for the specific transition to Exodus Chapter 1 if "ኦሪት ዘፀአት" is further down
      // In the view_file output:
      // 4730: ምድር በሣጥን ውስጥ አኖሩት። (End of Gen 50:26)
      // 4731: 
      // 4732: 
      // 4733: 
      // 4734: 50 
      // 4735: 
      // 4736: ምዕራፍ 1 (This is Exodus 1)

      // So if we see "ምዕራፍ 1" AND we have already processed Genesis 50, we should stop.
      // But "ምዕራፍ 1" also appears at the start of Genesis.
      // So we need a flag or just check if we are far enough.

      if (i > startIdx + 1000 && line.trim() === 'ምዕራፍ 1') {
        // Check context to be sure it's not just a reference
        // But simpler: just stop at "ኦሪት ዘፀአት" and then trim the end?
        // "ኦሪት ዘፀአት" is at line 4750.
        // If we include lines 4736-4749, we include Exodus 1:1-7 before the title "ኦሪት ዘፀአት".
        // Wait, the structure is weird.
        // Line 4736: ምዕራፍ 1
        // Line 4737: መግቢያ (Intro to Exodus?)
        // Line 4738: 1 ከያዕቆብ ጋር... (Exodus 1:1)
        // ...
        // Line 4750: ኦሪት ዘፀአት (Title)

        // So the title "ኦሪት ዘፀአት" comes AFTER Exodus 1:7? That's strange.
        // Ah, looking at lines 4750-4758, it seems like a "Introduction" section for Exodus.
        // But lines 4736-4749 seem to be Exodus 1:1-7.
        // Actually, lines 4736-4749 might be a summary or part of the previous book?
        // No, "ከያዕቆብ ጋር ወደ ግብጽ የገቡት..." is Exodus 1:1.
        // So Exodus starts at line 4736 with "ምዕራፍ 1".

        // So we must stop BEFORE line 4736.
        break;
      }

      extractedLines.push(line);
    }

    // Post-processing: Formatting
    // 1. Remove page numbers (lines with just numbers)
    // 2. Remove footnotes (lines starting with specific chars or small text at bottom?)
    //    In the view_file, footnotes looked like: "38: ሀ 2፥23 ..."
    //    They seem to be interspersed.
    //    We can try to filter lines that start with a single Ethiopic letter followed by space and numbers?
    //    Or lines that are just references.

    let cleanedLines = extractedLines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false; // Remove empty lines for now, we'll add breaks later
      if (/^\d+$/.test(trimmed)) return false; // Page numbers

      // Filter footnotes?
      // e.g. "ሀ 2፥23 ..."
      // Regex: ^[ሀ-ፐ]\s\d+
      if (/^[ሀ-ፐ]\s\d+/.test(trimmed)) return false;

      // Filter cross references?
      // e.g. "5፥1 ዘፍ. 1፥27..."
      // Regex: ^\d+፥\d+\s
      if (/^\d+፥\d+\s/.test(trimmed)) return false;

      return true;
    });

    // Join lines into paragraphs
    // We want to join lines unless it's a new Chapter or a Title.
    // Titles: "ኦሪት ዘፍጥረት", "መግቢያ", "ምዕራፍ ..."
    // Subtitles: "የዓለም አፈጣጠር", etc.
    // Verses start with a number: "1 በመጀመሪያ..."

    // Strategy:
    // Iterate and build paragraphs.
    // If a line starts with "ምዕራፍ", it's a header.
    // If a line looks like a title (short, no verse number), it's a header.
    // If a line starts with a verse number, it starts a new verse.
    // Otherwise, it continues the previous line.

    let formattedText = "";
    let currentParagraph = "";

    for (let line of cleanedLines) {
      line = line.trim();

      // Check for Headers
      if (line.startsWith('ምዕራፍ') ||
        line === 'ኦሪት ዘፍጥረት' ||
        line === 'መግቢያ' ||
        // Subtitles often don't have numbers. 
        // But verses start with numbers.
        // If line doesn't start with number and is short, treat as header?
        (!/^\d/.test(line) && line.length < 50)) {

        if (currentParagraph) {
          formattedText += currentParagraph + "\n\n";
          currentParagraph = "";
        }
        formattedText += line + "\n\n";
      }
      // Check for Verse start (e.g. "1 በመጀመሪያ")
      // Note: The text uses specific verse numbers like "1 ", "2 ", etc.
      // Sometimes they are "1 " or "1" followed by text.
      else if (/^\d+/.test(line)) {
        // New verse.
        // Should we start a new line for every verse? 
        // The user's sample had paragraphs.
        // Usually bibles have verses flowing in paragraphs, or one verse per line.
        // The prompt sample:
        // "1 በመጀመሪያ ... 2 ምድርም ... 3 እግዚአብሔርም ..."
        // They are inline.
        // But "ምዕራፍ 1" is separate.

        // Let's append to current paragraph if it exists, or start new if it's empty.
        // Actually, if it's a new verse, just append space.
        if (currentParagraph) {
          currentParagraph += " " + line;
        } else {
          currentParagraph = line;
        }
      } else {
        // Continuation of previous line
        if (currentParagraph) {
          currentParagraph += " " + line;
        } else {
          currentParagraph = line;
        }
      }
    }

    if (currentParagraph) {
      formattedText += currentParagraph + "\n";
    }

    // Final cleanup of extra spaces
    formattedText = formattedText.replace(/  +/g, ' ');

    fs.writeFileSync(OUTPUT_FILE, formattedText);
    console.log(`Successfully wrote formatted text to ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('Error processing file:', error);
  }
}

processText();
