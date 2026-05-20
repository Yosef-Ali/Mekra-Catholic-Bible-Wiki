import { config } from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../services/db';
import { chapterContents, books } from '../services/schema';
import { eq, and } from 'drizzle-orm';

config();

const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ Missing GEMINI_API_KEY');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey });

interface FormattedContent {
  sections: Array<{
    type: 'title' | 'poetry' | 'prose' | 'list' | 'footnote';
    title?: string;
    verses: Array<{
      verse_number: number;
      text: string;
      indent?: number; // For poetry
    }>;
    footnotes?: Array<{
      reference: string;
      text: string;
    }>;
  }>;
  metadata?: {
    hasPoetry: boolean;
    hasLists: boolean;
    hasFootnotes: boolean;
    verseCount: number;
  };
}

/**
 * Provide specific context for chapters known to contain poetry
 */
function getChapterContext(bookName: string, chapter: number): string {
  const contexts: Record<string, string> = {
    'Genesis:3': 'Contains God\'s curses/judgments in verses 14-19 (poetic oracles)',
    'Genesis:49': 'Jacob\'s blessing of his sons - entirely poetic',
    'Exodus:15': 'Song of Moses - entirely poetic',
    'Exodus:20': 'The Ten Commandments - structured list format',
    'Numbers:6': 'Contains the Priestly Blessing (verses 24-26) - poetic',
    'Deuteronomy:32': 'Song of Moses - entirely poetic',
    'Deuteronomy:33': 'Moses\' blessing - poetic',
    '2 Samuel:22': 'David\'s song of deliverance - entirely poetic',
    'Job:3-42': 'Most of Job is poetry/dialogue',
    'Psalms:1-150': 'All Psalms are poetry',
    'Proverbs:1-31': 'Most proverbs are poetry',
    'Song of Songs:1-8': 'Entirely poetic',
    'Isaiah:1-66': 'Primarily poetic prophecy',
    'Jeremiah:1-52': 'Mix of prose and poetic oracles',
    'Lamentations:1-5': 'Entirely poetic',
    'Ezekiel:1-48': 'Mix of prose narrative and poetic oracles',
    'Daniel:1-12': 'Mix of narrative and apocalyptic poetry',
  };

  const key = `${bookName}:${chapter}`;
  return contexts[key] || 'Standard narrative/prose format. Check for any embedded poetic passages, prayers, or formal speeches.';
}

/**
 * Use Gemini 3 to analyze and properly format chapter content
 */
async function analyzeAndFormatChapter(
  bookName: string,
  bookAmharicName: string,
  chapterNumber: number,
  rawContent: string
): Promise<FormattedContent> {

  const prompt = `You are analyzing a chapter from the Catholic Amharic Bible.

**Book:** ${bookAmharicName} (${bookName})
**Chapter:** ${chapterNumber}

**Raw Content:**
${rawContent}

**Your Task:**
Carefully analyze this content and identify different formatting elements:

1. **Poetry/Psalms** - Hebrew poetry has these characteristics:
   - Parallelism (similar ideas repeated in different words)
   - Structured speeches (God's oracles, judgments, blessings, curses)
   - Prophetic declarations
   - Songs, prayers, laments
   - Examples: All Psalms, Song of Songs, much of Job, Isaiah, Jeremiah
   - Also: Genesis 3:14-19 (curses), Genesis 49 (Jacob's blessing), Numbers 6:24-26 (priestly blessing)

2. **Lists** - Numbered or enumerated items (genealogies, laws, commandments)

3. **Footnotes/Footers** - Reference notes, cross-references (usually at bottom or marked with *)

4. **Main Content** - Regular narrative/prose text

**CRITICAL FORMATTING RULES:**
- CAREFULLY detect poetry even in narrative books (Genesis, Exodus contain poetic passages)
- Look for: formal speeches by God, blessings, curses, songs, prayers
- Separate poetry from prose by creating different sections
- Extract footnotes/footers and link them to their verse references
- Identify lists and structure them properly
- Preserve verse numbers
- Remove page numbers, headers, and non-content text
- Handle section titles (like "ምዕራፍ" headings)

**IMPORTANT CONTEXT for ${bookName} Chapter ${chapterNumber}:**
${getChapterContext(bookName, chapterNumber)}

**Output Format:**
Return a JSON object with this structure:
{
  "sections": [
    {
      "type": "title" | "poetry" | "prose" | "list" | "footnote",
      "title": "Section title if any",
      "verses": [
        {
          "verse_number": 1,
          "text": "Verse text in Amharic",
          "indent": 0  // For poetry: 0=main, 1=first indent, 2=second indent
        }
      ],
      "footnotes": [
        {
          "reference": "1:5",
          "text": "Footnote text"
        }
      ]
    }
  ],
  "metadata": {
    "hasPoetry": true/false,
    "hasLists": true/false,
    "hasFootnotes": true/false,
    "verseCount": total_verses
  }
}

**Examples:**

For Psalms (poetry):
{
  "type": "poetry",
  "verses": [
    {"verse_number": 1, "text": "እግዚአብሔር እረኛዬ ነው", "indent": 0},
    {"verse_number": 1, "text": "የሚያሳጣኝም የለም", "indent": 1}
  ]
}

For Prose:
{
  "type": "prose",
  "verses": [
    {"verse_number": 1, "text": "መጀመሪያ እግዚአብሔር ሰማይንና ምድርን ፈጠረ።"}
  ]
}

For content with footnotes:
{
  "type": "prose",
  "verses": [...],
  "footnotes": [
    {"reference": "1:1", "text": "በዕብራይስጥ: በረሲት"}
  ]
}
`;

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  title: { type: Type.STRING },
                  verses: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        verse_number: { type: Type.NUMBER },
                        text: { type: Type.STRING },
                        indent: { type: Type.NUMBER }
                      },
                      required: ['verse_number', 'text']
                    }
                  },
                  footnotes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        reference: { type: Type.STRING },
                        text: { type: Type.STRING }
                      },
                      required: ['reference', 'text']
                    }
                  }
                },
                required: ['type', 'verses']
              }
            },
            metadata: {
              type: Type.OBJECT,
              properties: {
                hasPoetry: { type: Type.BOOLEAN },
                hasLists: { type: Type.BOOLEAN },
                hasFootnotes: { type: Type.BOOLEAN },
                verseCount: { type: Type.NUMBER }
              }
            }
          },
          required: ['sections']
        },
        temperature: 0.1, // Low temperature for consistent formatting
      }
    });

    const text = response.text;
    if (!text) throw new Error('No response from Gemini');

    return JSON.parse(text);
  } catch (error) {
    console.error(`Failed to format ${bookAmharicName} ${chapterNumber}:`, error);
    throw error;
  }
}

/**
 * Process a specific chapter
 */
async function processChapter(bookId: number, chapterNumber: number) {
  // Get book info
  const [book] = await db.select().from(books).where(eq(books.id, bookId));
  if (!book) {
    console.error(`Book ${bookId} not found`);
    return;
  }

  console.log(`\n📖 Processing: ${book.amharicName} (${book.name}) - Chapter ${chapterNumber}`);

  // Get current content
  const [existing] = await db
    .select()
    .from(chapterContents)
    .where(
      and(
        eq(chapterContents.bookId, bookId),
        eq(chapterContents.chapterNumber, chapterNumber)
      )
    );

  if (!existing) {
    console.error(`Chapter not found in database`);
    return;
  }

  // Extract raw text from current content
  const currentContent = existing.content as any;
  let rawText = '';

  if (currentContent.sections) {
    rawText = currentContent.sections
      .map((s: any) => {
        if (s.title) rawText += `${s.title}\n`;
        if (s.verses) {
          return s.verses.map((v: any) => `[${v.verse_number}] ${v.text}`).join('\n');
        }
        return '';
      })
      .join('\n\n');
  } else {
    rawText = JSON.stringify(currentContent, null, 2);
  }

  console.log(`📄 Raw content length: ${rawText.length} characters`);

  // Analyze with Gemini 3
  console.log(`🤖 Analyzing with Gemini 3 Flash...`);
  const formatted = await analyzeAndFormatChapter(
    book.name,
    book.amharicName,
    chapterNumber,
    rawText
  );

  console.log(`✅ Analysis complete!`);
  const sections = formatted.sections || [];
  console.log(`   - Sections: ${sections.length}`);
  console.log(`   - Poetry: ${formatted.metadata?.hasPoetry ? 'Yes' : 'No'}`);
  console.log(`   - Lists: ${formatted.metadata?.hasLists ? 'Yes' : 'No'}`);
  console.log(`   - Footnotes: ${formatted.metadata?.hasFootnotes ? 'Yes' : 'No'}`);
  console.log(`   - Verses: ${formatted.metadata?.verseCount || 'Unknown'}`);

  // Derive paragraphBreaks from section boundaries (first verse of each section)
  const paragraphBreaks: number[] = [];
  for (const section of sections) {
    if (section.verses && section.verses.length > 0) {
      const firstVerse = section.verses[0].verse_number;
      if (firstVerse > 0 && !paragraphBreaks.includes(firstVerse)) {
        paragraphBreaks.push(firstVerse);
      }
    }
  }
  paragraphBreaks.sort((a, b) => a - b);
  console.log(`   - Paragraph breaks: [${paragraphBreaks.join(', ')}]`);

  // Build updated formattingRules (preserve existing, add paragraphBreaks)
  const existingRules = (existing.formattingRules as any) || {};
  const updatedFormattingRules = {
    ...existingRules,
    paragraphBreaks,
    ...(formatted.metadata && {
      hasPoetry: formatted.metadata.hasPoetry,
      hasLists: formatted.metadata.hasLists,
      hasFootnotes: formatted.metadata.hasFootnotes,
    }),
  };

  // Update database — content + formattingRules
  await db
    .update(chapterContents)
    .set({
      content: formatted as any,
      formattingRules: updatedFormattingRules as any,
      verified: 1,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(chapterContents.bookId, bookId),
        eq(chapterContents.chapterNumber, chapterNumber)
      )
    );

  console.log(`💾 Updated in database (content + paragraphBreaks)`);
}

/**
 * Process multiple chapters
 */
async function processBook(bookId: number, startChapter: number = 1, endChapter?: number) {
  const [book] = await db.select().from(books).where(eq(books.id, bookId));
  if (!book) {
    console.error(`Book ${bookId} not found`);
    return;
  }

  const end = endChapter || book.chapters;

  console.log(`\n🚀 Starting batch processing:`);
  console.log(`   Book: ${book.amharicName} (${book.name})`);
  console.log(`   Chapters: ${startChapter} to ${end}`);
  console.log(`   Total: ${end - startChapter + 1} chapters\n`);

  for (let chapter = startChapter; chapter <= end; chapter++) {
    try {
      await processChapter(bookId, chapter);
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Failed on chapter ${chapter}:`, error);
      // Continue with next chapter
    }
  }

  console.log(`\n✅ Batch processing complete!`);
}

// Main execution
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
Usage:
  npm run format:analyze <bookId> <chapterNumber>           # Process single chapter
  npm run format:analyze <bookId> <startChapter> <endChapter>  # Process range

Examples:
  npm run format:analyze 1 1          # Format Genesis Chapter 1
  npm run format:analyze 19 1 150     # Format all Psalms
  npm run format:analyze 40 1 28      # Format all of Matthew
  `);
  process.exit(1);
}

const bookId = parseInt(args[0]);
const start = parseInt(args[1]);
const end = args[2] ? parseInt(args[2]) : undefined;

if (end) {
  processBook(bookId, start, end).catch(console.error);
} else {
  processChapter(bookId, start).catch(console.error);
}
