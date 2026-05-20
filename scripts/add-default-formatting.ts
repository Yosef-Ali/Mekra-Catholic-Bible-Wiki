/**
 * Add default subtitles and paragraph breaks to ALL chapters missing formatting
 * This creates a baseline subtitle at verse 1 for every chapter
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function addDefaultFormatting() {
  console.log('Adding default formatting to all chapters...\n');
  
  // Get all chapters without subtitles
  const missing = await sql`
    SELECT c.id, c.book_id, c.chapter_number, c.content, c.formatting_rules,
           b.amharic_name
    FROM formatted_chapter_contents c
    JOIN books b ON c.book_id = b.id
    WHERE COALESCE(jsonb_array_length(c.formatting_rules->'subtitles'), 0) = 0
    ORDER BY b.id, c.chapter_number
  `;
  
  console.log(`Found ${missing.length} chapters without subtitles\n`);
  
  let updated = 0;
  let currentBook = '';
  
  for (const chapter of missing) {
    // Log book name when it changes
    if (chapter.amharic_name !== currentBook) {
      if (currentBook) console.log('');
      currentBook = chapter.amharic_name;
      process.stdout.write(`📖 ${currentBook}: `);
    }
    
    const content = chapter.content as any;
    const rules = chapter.formatting_rules as any || {};
    
    // Get verse count to create paragraph breaks
    let verseCount = 0;
    if (content?.sections) {
      for (const section of content.sections) {
        if (section.verses) {
          verseCount += section.verses.length;
        }
      }
    }
    
    // Create default paragraph breaks (roughly every 5-8 verses)
    const paragraphs: number[] = [1];
    for (let v = 5; v <= verseCount; v += 5) {
      paragraphs.push(v);
    }
    
    // Create a simple subtitle - just the chapter number indicator
    // In Amharic Bibles, chapters often just have "ምዕራፍ X" as header
    const subtitles = [{ verse: 1, text: `ምዕራፍ ${chapter.chapter_number}` }];
    
    // Check if content has section titles we can use
    if (content?.sections) {
      for (const section of content.sections) {
        if (section.title && section.verses?.length > 0) {
          const firstVerse = section.verses[0].verse_number;
          // Replace or add the subtitle
          const existing = subtitles.find(s => s.verse === firstVerse);
          if (existing) {
            existing.text = section.title;
          } else {
            subtitles.push({ verse: firstVerse, text: section.title });
          }
        }
      }
    }
    
    // Sort subtitles by verse
    subtitles.sort((a, b) => a.verse - b.verse);
    
    // Update formatting rules
    const updatedRules = {
      ...rules,
      subtitles: subtitles,
      paragraphBreaks: paragraphs
    };
    
    await sql`
      UPDATE formatted_chapter_contents 
      SET formatting_rules = ${JSON.stringify(updatedRules)}::jsonb
      WHERE id = ${chapter.id}
    `;
    
    process.stdout.write(`${chapter.chapter_number} `);
    updated++;
  }
  
  console.log(`\n\n✅ Updated ${updated} chapters with default formatting`);
}

addDefaultFormatting().catch(console.error);
