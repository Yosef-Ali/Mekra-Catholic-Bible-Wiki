import { config } from 'dotenv';
import { db } from '../services/db';
import { books } from '../services/schema';

config();

const allBooks = await db.select().from(books).limit(10);

console.log('📚 Books in database:\n');
allBooks.forEach(book => {
  console.log(`ID: ${book.id} | ${book.name} (${book.amharicName}) - ${book.chapters} chapters`);
});

console.log(`\nTotal books found: ${allBooks.length}`);
