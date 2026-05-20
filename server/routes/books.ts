import { Router } from 'express';
import { db } from '../../services/db';
import { books } from '../../services/schema';
import { eq, ilike, or } from 'drizzle-orm';

const router = Router();

// GET /api/books - Get all books
router.get('/', async (req, res) => {
  try {
    const allBooks = await db.select().from(books);
    res.json({
      success: true,
      data: allBooks
    });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch books' 
    });
  }
});

// GET /api/books/search - Search books (must come before :id route)
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ 
        success: false,
        error: 'Search query is required' 
      });
    }

    const searchPattern = `%${query}%`;
    const results = await db.select().from(books).where(
      or(
        ilike(books.name, searchPattern),
        ilike(books.amharicName, searchPattern)
      )
    );

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error searching books:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to search books' 
    });
  }
});

// GET /api/books/section/:section - Get books by section (OT, NT, Apocrypha)
router.get('/section/:section', async (req, res) => {
  try {
    const section = req.params.section;
    if (!['OT', 'NT', 'Apocrypha'].includes(section)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid section. Must be OT, NT, or Apocrypha' 
      });
    }

    const sectionBooks = await db.select().from(books).where(eq(books.section, section));
    res.json({
      success: true,
      data: sectionBooks
    });
  } catch (error) {
    console.error('Error fetching books by section:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch books' 
    });
  }
});

// GET /api/books/:id - Get a single book by ID (must come after specific routes)
router.get('/:id', async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    if (isNaN(bookId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid book ID' 
      });
    }

    const book = await db.select().from(books).where(eq(books.id, bookId));

    if (book.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Book not found' 
      });
    }

    res.json({
      success: true,
      data: book[0]
    });
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch book' 
    });
  }
});

export default router;
