
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

    for (let i = startIdx; i < lines.length; i++) {
      let line = lines[i];

      // Stop if we reach Exodus
      if (line.includes('ኦሪት ዘፀአት')) {
        break;
      }
      extractedLines.push(line);
    }

    // Post-processing: Filtering Artifacts

    let cleanedLines: string[] = [];
    let seenTitle = false;
    let currentChapter = 0;
    let inFootnoteBlock = false;

    for (let line of extractedLines) {
      let trimmed = line.trim();

      if (!trimmed) {
        inFootnoteBlock = false; // Reset on empty line
        continue;
      }

      // Safety valve: If line looks like a Verse or Header, break out of footnote block
      if (inFootnoteBlock) {
        const isVerse = /^\d+\s/.test(trimmed) || /^\d+$/.test(trimmed); // Digit followed by space (verse) or just digit (page num - but page num is artifact)
        // Actually verse numbers in this text are "1 " or "1" (if line ends).
        // But page numbers are also "1".
        // However, page numbers usually don't appear inside a footnote block without empty lines?
        // Let's stick to explicit headers and verse patterns like "1 " (digit space).
        const isHeader = trimmed.startsWith('ምዕራፍ') || trimmed === 'ኦሪት ዘፍጥረት' || trimmed === 'መግቢያ';

        if (isHeader || /^\d+\s/.test(trimmed)) {
          inFootnoteBlock = false;
        }
      }

      if (inFootnoteBlock) {
        continue; // Skip footnote content
      }

      // Filter page numbers (just digits)
      if (/^\d+$/.test(trimmed)) continue;

      // Filter running headers
      if (trimmed.includes('ኦሪት ዘፍጥረት')) {
        if (trimmed === 'ኦሪት ዘፍጥረት' && !seenTitle) {
          seenTitle = true;
        } else {
          continue;
        }
      }

      // Check for Footnote Start
      // e.g. "ሀ 2፥23 ..."
      if (/^[ሀ-ፐ]\s\d+/.test(trimmed)) {
        inFootnoteBlock = true;
        continue;
      }

      // Check for Cross References
      // e.g. "5፥1 ዘፍ. 1፥27..."
      if (/^\d+፥\d+\s/.test(trimmed)) {
        continue; // Skip single line cross ref
      }

      // Track Chapter to detect end of Genesis (Safety)
      if (trimmed.startsWith('ምዕራፍ')) {
        const match = trimmed.match(/ምዕራፍ\s*(\d+)/);
        if (match) {
          const chapNum = parseInt(match[1]);
          if (chapNum === 1 && currentChapter >= 50) {
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
      const isExplicitHeader =
        line.startsWith('ምዕራፍ') ||
        line === 'ኦሪት ዘፍጥረት' ||
        line === 'መግቢያ' ||
        /^[ሀ-ፐ]\.\s/.test(line);

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
        if (currentParagraph) {
          formattedText += currentParagraph + "\n\n";
          currentParagraph = "";
        }
        formattedText += line + "\n\n";
      } else {
        if (currentParagraph) {
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

    formattedText = formattedText.replace(/  +/g, ' ');
    formattedText = formattedText.replace(/ \n/g, '\n').replace(/\n /g, '\n');

    fs.writeFileSync(OUTPUT_FILE, formattedText);
    console.log(`Successfully wrote formatted text to ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('Error processing file:', error);
  }
}

processText();
