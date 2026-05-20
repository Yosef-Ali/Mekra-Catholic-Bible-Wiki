/**
 * Quick Test: Fix Genesis 3 Formatting
 * Tests the formatting detection on a known poetry chapter
 */

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

async function testGenesis3() {
  console.log('🧪 Testing formatting detection on Genesis 3...\n');
  console.log('   Expected: Poetry in verses 14-19 (God\'s curses)\n');

  // Get Genesis 3 content
  const [chapter] = await db
    .select({
      content: chapterContents.content,
      formattingRules: chapterContents.formattingRules
    })
    .from(chapterContents)
    .where(
      and(
        eq(chapterContents.bookId, 147),
        eq(chapterContents.chapterNumber, 3)
      )
    );

  if (!chapter) {
    console.error('❌ Genesis 3 not found in database');
    return;
  }

  console.log('📄 Current formatting rules:', chapter.formattingRules ? 'EXISTS' : 'NULL');

  // Extract text
  let rawText = '';
  const content = chapter.content as any;
  if (content.sections) {
    rawText = content.sections
      .map((s: any) => {
        let text = '';
        if (s.title) text += `${s.title}\n`;
        if (s.verses) {
          text += s.verses.map((v: any) => `[${v.verse_number}] ${v.text}`).join('\n');
        }
        return text;
      })
      .join('\n\n');
  }

  console.log(`\n📖 Content preview (first 1000 chars):\n${rawText.substring(0, 1000)}...\n`);

  // Analyze with Gemini
  console.log('🤖 Analyzing with Gemini 2.0 Flash...\n');

  const prompt = `Analyze this Amharic Catholic Bible chapter (Genesis 3) to identify formatting.

**Known poetic passage:** Verses 14-19 contain God's curses on the serpent, Eve, and Adam - these are poetic oracles with parallel structure.

**Content:**
${rawText.substring(0, 12000)}

**Identify verse ranges for:**
1. **Poetry** - Look for parallelism, formal speeches, curses
2. **Prose** - Regular narrative
3. **Lists** - Any enumerated items

Return JSON structure.`;

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
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
                  verseRange: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                  indent: { type: Type.NUMBER }
                },
                required: ['type', 'verseRange']
              }
            },
            hasPoetry: { type: Type.BOOLEAN },
            hasLists: { type: Type.BOOLEAN },
            hasFootnotes: { type: Type.BOOLEAN },
            primaryStyle: { type: Type.STRING }
          },
          required: ['sections', 'hasPoetry', 'hasLists', 'hasFootnotes', 'primaryStyle']
        },
        temperature: 0.1,
      }
    });

    const result = JSON.parse(response.text || '{}');
    
    console.log('📊 Analysis Result:');
    console.log(JSON.stringify(result, null, 2));

    // Verify poetry detection
    const poetrySections = result.sections?.filter((s: any) => s.type === 'poetry') || [];
    
    console.log('\n✅ Validation:');
    console.log(`   Has poetry: ${result.hasPoetry ? '✅ Yes' : '❌ No (EXPECTED: Yes)'}`);
    console.log(`   Primary style: ${result.primaryStyle}`);
    console.log(`   Poetry sections found: ${poetrySections.length}`);
    
    if (poetrySections.length > 0) {
      console.log('   Poetry ranges:');
      poetrySections.forEach((s: any) => {
        console.log(`      - Verses ${s.verseRange[0]}-${s.verseRange[1]}`);
      });
    }

    // Check if 14-19 is detected as poetry
    const cursesDetected = poetrySections.some((s: any) => 
      s.verseRange[0] <= 14 && s.verseRange[1] >= 19
    );
    console.log(`\n   Curses (14-19) detected as poetry: ${cursesDetected ? '✅ Yes' : '⚠️ Partial/No'}`);

    // Save to database
    console.log('\n💾 Saving to database...');
    await db
      .update(chapterContents)
      .set({
        formattingRules: result,
        verified: 1,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(chapterContents.bookId, 147),
          eq(chapterContents.chapterNumber, 3)
        )
      );
    console.log('✅ Saved!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testGenesis3().catch(console.error);
