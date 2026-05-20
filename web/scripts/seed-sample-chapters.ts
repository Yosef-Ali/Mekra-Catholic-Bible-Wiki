import fs from 'fs';
import { db } from '../services/db';
import { books, chapterContents } from '../services/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Manual seed script for Bible chapter content
 * This seeds Genesis Chapter 1 as a test
 */

async function seedSampleChapters() {
  console.log('📖 Seeding sample Bible chapters...\n');

  try {
    // Find Genesis in the database
    const genesisBook = await db.select().from(books).where(eq(books.name, 'Genesis')).limit(1);

    if (genesisBook.length === 0) {
      console.log('⚠️  Genesis not found in database. Run pnpm db:seed first!');
      return;
    }

    const genesis = genesisBook[0];
    console.log(`✅ Found Genesis (ID: ${genesis.id})`);

    // Sample content for Genesis Chapter 1 (extracted from the PDF)
    const genesisChapter1 = `[1] በመጀመሪያ እግዚአብሔር ሰማያትንና ምድርን ፈጠረ። [2] ምድርም ቅርጽ የሌላትና ባዶ ነበረች፤ ጨለማም በጥልቁ ላይ ነበረ፤ የእግዚአብሔርም መንፈስ በውኃ ላይ ሰፍፎ ነበር። [3] እግዚአብሔርም፦ "ብርሃን ይሁን" ኣለ፤ ብርሃንም ሆነ። [4] እግዚአብሔርም ብርሃኑ መልካም እንደሆነ አየ፤ እግዚብሔርም ብርሃንንና ጨለማን ለየ። [5] እግዚአብሔርም ብርሃኑን ቀን ብሎ ጠራው፥ ጨለማውንም ሌሊት አለው። ማታም ሆነ ጥዋትም ሆነ፥ አንደኛ ቀን።

[6] እግዚአብሔርም፦ "በውኆች መካከል ጠፈር ይሁን፥ በውኃና በውኃ መካከልም ይክፈል" አለ። [7] እግዚአብሔርም ጠፈርን አደረገ፥ ከጠፈር በታችና ከጠፈር በላይ ያሉትንም ውኆች ለየ፥ እንዲሁም ሆነ። [8] እግዚአብሔር ጠፈርን "ሰማይ" ብሎ ጠራው። ማታም ሆነ ጥዋትም ሆነ፥ ሁለተኛ ቀን ሆነ።

[9] እግዚአብሔርም፦ "ከሰማይ በታች ያለው ውኃ በአንድ ስፍራ ይሰብሰብ፥ የብሱም ይገለጥ" አለ፤ እንዲሁም ሆነ። [10] እግዚአብሔርም የብሱን "ምድር" ብሎ ጠራው፥ በአንድ ስፍራ የተሰበሰበውንም ውሃ "ባሕር" አለው፥ እግዚእብሔርም ያ መልካም እንደሆነ አየ። [11] እግዚአብሔርም፦ "ምድር ዘርን የሚሰጥ ሣርንና ቡቃያን በምድር ላይ እንደ ወገኑ ዘሩ ያለበትን ፍሬን የሚያፈራ ዛፍን ታብቅል" አለ፥ እንዲሁም ሆነ። [12] ምድርም ዘርን የሚሰጥ ሣርንና ቡቃያን እንደ ወገኑ ዘሩም ያለበትን ፍሬን የሚያፈራ ዛፍን እንደ ወገኑ አበቀለች። እግዚአብሔርም ያ መልካም እንደሆነ አየ። [13] ማታም ሆነ ጥዋትም ሆነ፥ ሦስተኛ ቀን።

[14] እግዚአብሔርም አለ፦ "ቀንና ሌሊትን ይለዩ ዘንድ ብርሃናት በሰማይ ጠፈር ይሁኑ፥ ለምልክቶች ለዘመኖች ለዕለታት ለዓመታትም ይሁኑ፥ [15] በምድር ላይ ያበሩ ዘንድ በሰማይ ጠፈር ብርሃናት ይሁኑ፥" እንዲሁም ሆነ። [16] እግዚእብሔርም ሁለት ታላላቆች ብርሃናትን አደረገ፥ ትልቁ ብርሃን በቀን እንዲሠለጥን፥ ትንሹም ብርሃን በሌሊት እንዲሰለጥን፥ ከዋክብትንም ደግሞ አደረገ። [17] እግዚአሔርም በምድር ላይ ያበሩ ዘንድ በሰማይ ጠፈር አኖራቸው፥ [18] በቀንም በሌሊትም እንዲሠለጥኑ፥ ብርሃንንና ጨለማንም እንዲለዩ፥ እግዚአብሔርም ያ መልካም እንደሆነ አየ። [19] ማታም ሆነ ጥዋትም ሆነ፥ አራተኛ ቀን።

[20] እግዚአብሔርም አለ፦ "ውኃ ሕያው ነፍስ ያላቸውን ተንቀሳቃሾች ታስገኝ፥ ወፎችም ከምድር በላይ ከሰማይ ጠፈር በታች ይብረሩ።" [21] እግዚእብሔርም ታላላቆች አንበሪዎችን፥ ውኃይቱ እንደ ወገኑ ያስገኘቻቸውን ተንቀሳቃሾቹን ሕያዋን ፍጥረታት ሁሉ፥ እንደ ወገኑ የሚበሩትንም ወፎች ሁሉ ፈጠረ፥ እግዚእብሔርም ያ መልካም እንደሆነ አየ። [22] እግዚእብሔርም እንዲህ ብሎ ባረካቸው፦ "ብዙ ተባዙም የባሕርንም ውኃ ሙሉአት፥ ወፎችም በምድር ላይ ይብዙ።" [23] ማታም ሆነ ጥዋትም ሆነ፥ አምስተኛ ቀን።

[24] እግዚአብሔርም አለ፦ "ምድር ሕያዋን ፍጥረታትን እንደ ወገኑ፥ የከብትንና የሚሸበሽቡትን እንደዚሁም የምድር አራዊትን እንደ ወገኑ ታውጣ፥" እንዲሁም ሆነ። [25] እግዚአብሔር የምድርን አራዊት እንደ ወገኑ፥ የከብትንም እንደ ወገኑ፥ በምድር ላይ የሚሸበሽቡትንም ሁሉ እንደ ወገኑ አደረገ። እግዚአብሔርም ያ መልካም እንደሆነ አየ።

[26] እግዚአብሔርም፦ "ሰውን በመልካችን፥ እንደ አምሳላችን እንፍጥር፥ በባሕር ዓሦች ላይ፥ በሰማይም ወፎች ላይ፥ በከብት ላይ፥ በምድርም ሁሉ ላይ እንዲሁም በምድር ላይ በሚሸበሽቡት ተሸባሾች ሁሉ ላይ ይገዛ፥" አለ። [27] እግዚአብሔር ሰውን በራሱ መልክ ፈጠረው፥ በእግዚአብሔር መልክ ፈጠረው፥ ወንድና ሴት አደረጋቸው። [28] እግዚአብሔርም ባረካቸው፥ እግዚአብሔርም፦ "ብዙ ተባዙ፥ ምድርንም ሙሉአት፥ ገዛትም፥ በባሕር ዓሦችም ላይ፥ በሰማይ ወፎችም ላይ፥ በምድር ላይም ባሉት በሚንቀሳቀሱ ፍጥረታት ሁሉ ላይ ግዙ፥" አላቸው።

[29] እግዚአብሔርም፦ "እነሆ፥ በምድር ሁሉ ላይ ያለውን ዘርን የሚሰጥ ክስት ሁሉ፥ ዘሩም የሚሰጥ ፍሬን የሚያፈራ ዛፍን ሁሉ ሰጠኋችሁ፥ ለእናንተ ለምግብ ይሆን። [30] ለምድር አራዊትም ሁሉ፥ ለሰማይም ወፎች ሁሉ፥ በምድር ላይ ለሚሸበሽቡትም ሁሉ፥ ሕያው ነፍስ ላላቸውም ሁሉ የአረንጓዴውን ክስት ሁሉ ለምግብ ሰጠሁ፥" አለ፤ እንዲሁም ሆነ። [31] እግዚአብሔርም ያደረገውን ሁሉ አየ፥ እነሆም፥ በጣም መልካም ነበረ። ማታም ሆኘ ጥዋትም ሆነ፥ ስድስተኛ ቀን።`;

    // Check if chapter already exists
    const existing = await db.select().from(chapterContents)
      .where(and(
        eq(chapterContents.bookId, genesis.id),
        eq(chapterContents.chapterNumber, 1)
      ))
      .limit(1);

    if (existing.length > 0) {
      console.log('⚠️  Genesis Chapter 1 already exists. Updating...');
      await db.update(chapterContents)
        .set({
          content: genesisChapter1,
          verified: 1,
          updatedAt: new Date()
        })
        .where(and(
          eq(chapterContents.bookId, genesis.id),
          eq(chapterContents.chapterNumber, 1)
        ));
      console.log('✅ Updated Genesis Chapter 1');
    } else {
      // Insert new chapter
      await db.insert(chapterContents).values({
        bookId: genesis.id,
        chapterNumber: 1,
        content: genesisChapter1,
        verified: 1,
      });
      console.log('✅ Inserted Genesis Chapter 1');
    }

    console.log('\n📊 Summary:');
    console.log('   Books seeded: 1 (Genesis)');
    console.log('   Chapters seeded: 1 (Chapter 1)');
    console.log('   Verses: 31');
    console.log('\n✅ Seeding completed! Test by loading Genesis Chapter 1 in the Bible Reader.');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

seedSampleChapters();
