
import { db } from '../services/db';
import { books } from '../services/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function updateBookImages() {
  console.log('Updating book images...');

  // Updates specific books with their hero images
  // For now, we will just update Psalms with the David image we generated, 
  // but this structure allows us to add more mappings easily.
  const imageMappings: Record<string, string> = {
    // Psalms (David)
    'Psalms': '/hero_david.png',

    // Example: Genesis (Creation/Garden) - Placeholder for when we generate it
    // 'Genesis': '/hero_genesis.png',
  };

  for (const [bookName, imageUrl] of Object.entries(imageMappings)) {
    console.log(`Updating ${bookName} with ${imageUrl}...`);

    // Find the book by English name
    const book = await db.select().from(books).where(eq(books.name, bookName));

    if (book.length > 0) {
      await db.update(books)
        .set({ heroImage: imageUrl })
        .where(eq(books.id, book[0].id));
      console.log(`✅ Updated ${bookName}`);
    } else {
      console.log(`❌ Book not found: ${bookName}`);
    }
  }

  console.log('Done!');
  process.exit(0);
}

updateBookImages().catch((err) => {
  console.error('Error updating images:', err);
  process.exit(1);
});
