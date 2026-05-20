/**
 * Extract subtitles from content sections and save to formattingRules
 * This ensures all existing titles in the database are properly displayed
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function extractSubtitles() {
  console.log('📖 Extracting subtitles from content sections...\n');
  
  // Get all chapters with book name to avoid N+1 queries
  const chapters = await sql`
    SELECT c.id, c.book_id, c.chapter_number, c.content, c.formatting_rules,
           b.amharic_name
    FROM formatted_chapter_contents c
    JOIN books b ON c.book_id = b.id
    ORDER BY c.book_id, c.chapter_number
  `;
  
  let updated = 0;
  let withTitles = 0;
  
  for (const chapter of chapters) {
    const content = chapter.content as any;
    const sections = content?.sections || [];
    
    // Extract titles from sections
    const subtitles: { verse: number; text: string }[] = [];
    
    for (const section of sections) {
      if (section.title && section.verses?.length > 0) {
        const firstVerse = section.verses[0].verse_number;
        subtitles.push({ verse: firstVerse, text: section.title });
      }
    }
    
    if (subtitles.length > 0) {
      withTitles++;
      
      // Merge with existing formattingRules
      const existingRules = chapter.formatting_rules as any || {};
      const existingSubtitles = existingRules.subtitles || [];
      
      // Combine subtitles (avoid duplicates)
      const allSubtitles = [...existingSubtitles];
      for (const newSub of subtitles) {
        if (!allSubtitles.some(s => s.verse === newSub.verse)) {
          allSubtitles.push(newSub);
        }
      }
      
      // Sort by verse number
      allSubtitles.sort((a, b) => a.verse - b.verse);
      
      const updatedRules = {
        ...existingRules,
        subtitles: allSubtitles
      };
      
      await sql`
        UPDATE formatted_chapter_contents 
        SET formatting_rules = ${JSON.stringify(updatedRules)}::jsonb
        WHERE id = ${chapter.id}
      `;
      
      updated++;

      // Log progress
      console.log(`✅ ${chapter.amharic_name} ${chapter.chapter_number}: ${subtitles.length} subtitles`);
      subtitles.forEach(s => console.log(`     v${s.verse}: ${s.text}`));
    }
  }
  
  console.log(`\n✅ Found ${withTitles} chapters with titles, updated ${updated}`);
}

extractSubtitles().catch(console.error);
