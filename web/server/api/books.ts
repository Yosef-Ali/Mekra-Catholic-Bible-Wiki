import { db } from '../../services/db';
import { books } from '../../services/schema';
import { eq } from 'drizzle-orm';

// Server action: Get all books from database
export async function getAllBooks() {
  try {
    const allBooks = await db.select().from(books).orderBy(books.id);
    return { success: true, data: allBooks };
  } catch (error) {
    console.error('Error fetching books:', error);
    return { success: false, error: 'Failed to fetch books' };
  }
}

// Server action: Get a single book by ID
export async function getBookById(id: number) {
  try {
    const book = await db.select().from(books).where(eq(books.id, id));

    if (book.length === 0) {
      return { success: false, error: 'Book not found' };
    }

    return { success: true, data: book[0] };
  } catch (error) {
    console.error('Error fetching book:', error);
    return { success: false, error: 'Failed to fetch book' };
  }
}

// Server action: Get books by section
export async function getBooksBySection(section: 'OT' | 'NT' | 'Apocrypha') {
  try {
    const sectionBooks = await db.select().from(books).where(eq(books.section, section));
    return { success: true, data: sectionBooks };
  } catch (error) {
    console.error('Error fetching books by section:', error);
    return { success: false, error: 'Failed to fetch books' };
  }
}

// Server action: Search books by name (English or Amharic)
export async function searchBooks(query: string) {
  try {
    const allBooks = await db.select().from(books);
    const filtered = allBooks.filter(book =>
      book.name.toLowerCase().includes(query.toLowerCase()) ||
      book.amharicName.includes(query)
    );
    return { success: true, data: filtered };
  } catch (error) {
    console.error('Error searching books:', error);
    return { success: false, error: 'Failed to search books' };
  }
}
