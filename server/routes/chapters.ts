import { Router, Request, Response } from 'express';
import { db } from '../../services/db';
import { chapterContents, books } from '../../services/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/chapters/:bookId/:chapterNumber
 * Fetch a specific chapter content from the database
 */
router.get('/:bookId/:chapterNumber', async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.bookId);
    const chapterNumber = parseInt(req.params.chapterNumber);

    if (isNaN(bookId) || isNaN(chapterNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid book ID or chapter number'
      });
    }

    // Query the database for the chapter content
    const result = await db.select()
      .from(chapterContents)
      .where(and(
        eq(chapterContents.bookId, bookId),
        eq(chapterContents.chapterNumber, chapterNumber)
      ))
      .limit(1);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Chapter not found in database',
        fallbackToAI: true // Signal to frontend to use AI generation as fallback
      });
    }

    const chapter = result[0];

    res.json({
      success: true,
      data: {
        id: chapter.id,
        bookId: chapter.bookId,
        chapterNumber: chapter.chapterNumber,
        content: chapter.content,
        verified: chapter.verified
      }
    });

  } catch (error) {
    console.error('Error fetching chapter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chapter content',
      message: error instanceof Error ? error.message : 'Unknown error',
      fallbackToAI: true
    });
  }
});

/**
 * GET /api/chapters/book/:bookId
 * Get all available chapters for a given book
 */
router.get('/book/:bookId', async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.bookId);

    if (isNaN(bookId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid book ID'
      });
    }

    const chapters = await db.select({
      chapterNumber: chapterContents.chapterNumber,
      verified: chapterContents.verified
    })
      .from(chapterContents)
      .where(eq(chapterContents.bookId, bookId))
      .orderBy(chapterContents.chapterNumber);

    res.json({
      success: true,
      data: chapters
    });

  } catch (error) {
    console.error('Error fetching book chapters:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch book chapters',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/chapters/:bookId/:chapterNumber
 * Update chapter content in the database
 */
router.put('/:bookId/:chapterNumber', async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.bookId);
    const chapterNumber = parseInt(req.params.chapterNumber);
    const { content } = req.body;

    if (isNaN(bookId) || isNaN(chapterNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid book ID or chapter number'
      });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Content must be a string'
      });
    }

    // Update the chapter content
    const result = await db.update(chapterContents)
      .set({
        content,
        verified: 1 // Mark as verified since it's manually edited
      })
      .where(and(
        eq(chapterContents.bookId, bookId),
        eq(chapterContents.chapterNumber, chapterNumber)
      ))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Chapter not found in database'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Chapter updated successfully',
        updatedChapter: result[0]
      }
    });

  } catch (error) {
    console.error('Error updating chapter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update chapter content',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
