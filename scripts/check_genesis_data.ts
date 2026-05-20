
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and } from 'drizzle-orm';

async function checkData() {
  console.log('🔍 Checking Database Data...');

  // Check Books
  const allBooks = await db.select().from(books);
  console.log(`📚 Total Books: ${allBooks.length}`);

  const genesis = allBooks.find(b => b.name === 'Genesis' || b.name === 'ኦሪት ዘፍጥረት');

  if (genesis) {
    console.log(`✅ Found Genesis: ID=${genesis.id}, Name=${genesis.name}, AM=${genesis.amharicName}, Chapters=${genesis.chapters}`);

    // Check Content for Genesis Chapter 1
    const ch1 = await db.select().from(chapterContents).where(
      and(
        eq(chapterContents.bookId, genesis.id),
        eq(chapterContents.chapterNumber, 1)
      )
    );

    if (ch1.length > 0) {
      console.log(`✅ Found Genesis Chapter 1`);
      console.log(`   Content Type: ${typeof ch1[0].content}`);
      if (typeof ch1[0].content === 'object') {
        console.log(`   Is Array: ${Array.isArray(ch1[0].content)}`);
        console.log(`   Has Sections: ${'sections' in (ch1[0].content as object)}`);
        const content = ch1[0].content as any;
        if (content.sections) {
          console.log(`   Sections Count: ${content.sections.length}`);
          if (content.sections.length > 0) {
            console.log(`   Verses in Section 1: ${content.sections[0].verses.length}`);
          }
        }
      } else {
        console.log(`   Content (Preview): ${String(ch1[0].content).substring(0, 50)}...`);
      }
    } else {
      console.log(`❌ Genesis Chapter 1 NOT FOUND in chapterContents table`);
    }

  } else {
    console.log('❌ Genesis NOT FOUND in books table');
  }

  process.exit(0);
}

checkData().catch(console.error);
