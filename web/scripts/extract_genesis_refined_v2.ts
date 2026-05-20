
import fs from 'fs';

const INPUT_FILE = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/amharic_bible_extracted.txt';
const OUTPUT_FILE = '/Users/mekdesyared/Fna-Catholic-Bible /Mekra-Catholic-Bible/Genesis_Amharic.txt';

const START_LINE = 343; // "ኦሪት ዘፍጥረት"

function processText() {
  try {
    const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
    const lines = fileContent.split('\n');

    let extractedLines: string[] = [];

    // Adjust for 0-based index
    const startIdx = START_LINE - 1;

    let foundExodus = false;

    for (let i = startIdx; i < lines.length; i++) {
      let line = lines[i];

      // Stop if we reach Exodus
      if (line.includes('ኦሪት ዘፀአት')) {
        foundExodus = true;
        break;
      }

      // Safety break if we go too far (e.g. into Exodus Chapter 1 before title)
      // Exodus 1 starts with "ምዕራፍ 1" around line 4736
      // But Genesis also has "ምዕራፍ 1".
      // We need to be careful.
      // We can track the current chapter of Genesis.
      // If we see "ምዕራፍ 1" AGAIN after passing Chapter 50, then we stop.

      extractedLines.push(line);
    }

    // Post-processing: Formatting

    let cleanedLines: string[] = [];
    let seenTitle = false;
    let currentChapter = 0;

    for (let line of extractedLines) {
      let trimmed = line.trim();
      if (!trimmed) continue;

      // Filter page numbers (just digits)
      if (/^\d+$/.test(trimmed)) continue;

      // Filter running headers
      // "ኦሪት ዘፍጥረት" appears as running header.
      // We want to keep the FIRST one (Title).
      if (trimmed.includes('ኦሪት ዘፍጥረት')) {
        // Check if it's the main title or running header
        // Main title is just "ኦሪት ዘፍጥረት" usually.
        // Running headers might have numbers "ኦሪት ዘፍጥረት 1-2"
        if (trimmed === 'ኦሪት ዘፍጥረት' && !seenTitle) {
          seenTitle = true;
        } else {
          // It's a running header or duplicate
          continue;
        }
      }

      // Filter footnotes
      // e.g. "ሀ 2፥23 ..."
      if (/^[ሀ-ፐ]\s\d+/.test(trimmed)) continue;
      // Cross references e.g. "5፥1 ዘፍ. 1፥27..."
      if (/^\d+፥\d+\s/.test(trimmed)) continue;

      // Track Chapter to detect end of Genesis
      if (trimmed.startsWith('ምዕራፍ')) {
        const match = trimmed.match(/ምዕራፍ\s*(\d+)/);
        if (match) {
          const chapNum = parseInt(match[1]);
          if (chapNum === 1 && currentChapter >= 50) {
            // This is Exodus Chapter 1!
            break;
          }
          currentChapter = chapNum;
        }
      }

      cleanedLines.push(trimmed);
    }

    // Join lines into paragraphs
    let formattedText = "";
    let currentParagraph = "";

    for (let i = 0; i < cleanedLines.length; i++) {
      let line = cleanedLines[i];

      // Detect Headers
      // 1. Explicit Headers
      const isExplicitHeader =
        line.startsWith('ምዕራፍ') ||
        line === 'ኦሪት ዘፍጥረት' ||
        line === 'መግቢያ' ||
        /^[ሀ-ፐ]\.\s/.test(line); // Subheaders like "ሀ. ..."

      // 2. Contextual Headers (Titles)
      // If previous line was a Header, and this line is short and not a verse, it's likely a title.
      // e.g. "ምዕራፍ 1" -> "የዓለም አፈጣጠር"
      let isTitle = false;
      if (i > 0) {
        const prevLine = cleanedLines[i - 1];
        if ((prevLine.startsWith('ምዕራፍ') || prevLine === 'መግቢያ') &&
          !/^\d/.test(line) &&
          line.length < 60) {
          isTitle = true;
        }
      }

      if (isExplicitHeader || isTitle) {
        // Flush current paragraph
        if (currentParagraph) {
          formattedText += currentParagraph + "\n\n";
          currentParagraph = "";
        }
        formattedText += line + "\n\n";
      } else {
        // Text content
        if (currentParagraph) {
          // Add space if needed
          if (!currentParagraph.endsWith(' ')) {
            currentParagraph += " ";
          }
          currentParagraph += line;
        } else {
          currentParagraph = line;
        }
      }
    }

    if (currentParagraph) {
      formattedText += currentParagraph + "\n";
    }

    // Final cleanup
    // Remove multiple spaces
    formattedText = formattedText.replace(/  +/g, ' ');
    // Ensure newlines around headers are clean (regex might have left spaces)
    formattedText = formattedText.replace(/ \n/g, '\n').replace(/\n /g, '\n');

    fs.writeFileSync(OUTPUT_FILE, formattedText);
    console.log(`Successfully wrote formatted text to ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('Error processing file:', error);
  }
}

processText();
