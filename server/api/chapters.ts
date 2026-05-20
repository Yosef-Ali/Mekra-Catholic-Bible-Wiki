import { db } from '../../services/db';
import { chapterContents, books } from '../../services/schema';
import { eq, and, like } from 'drizzle-orm';

/**
 * Server action: Get chapter content from database
 */
export async function getChapterContent(bookId: number, chapterNumber: number) {
  try {
    const result = await db.select()
      .from(chapterContents)
      .where(and(
        eq(chapterContents.bookId, bookId),
        eq(chapterContents.chapterNumber, chapterNumber)
      ))
      .limit(1);

    if (result.length === 0) {
      return {
        success: false,
        error: 'Chapter not found in database',
        fallbackToAI: true
      };
    }

    const chapter = result[0];

    return {
      success: true,
      data: {
        id: chapter.id,
        bookId: chapter.bookId,
        chapterNumber: chapter.chapterNumber,
        content: chapter.content,
        verified: chapter.verified,
        formattingRules: chapter.formattingRules
      }
    };

  } catch (error) {
    console.error('Error fetching chapter:', error);
    return {
      success: false,
      error: 'Failed to fetch chapter content',
      message: error instanceof Error ? error.message : 'Unknown error',
      fallbackToAI: true
    };
  }
}

/**
 * Server action: Update chapter content
 */
export async function updateChapterContent(bookId: number, chapterNumber: number, content: string) {
  try {
    const result = await db.update(chapterContents)
      .set({ 
        content,
        updatedAt: new Date()
      })
      .where(and(
        eq(chapterContents.bookId, bookId),
        eq(chapterContents.chapterNumber, chapterNumber)
      ))
      .returning();

    if (result.length === 0) {
      return {
        success: false,
        error: 'Chapter not found'
      };
    }

    return {
      success: true,
      data: result[0]
    };

  } catch (error) {
    console.error('Error updating chapter:', error);
    return {
      success: false,
      error: 'Failed to update chapter',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Server action: Search chapters for pattern (bulk edit)
 */
export async function searchChapters(pattern: string) {
  try {
    // Get all chapters that contain the pattern
    const results = await db.select({
      id: chapterContents.id,
      bookId: chapterContents.bookId,
      chapterNumber: chapterContents.chapterNumber,
      content: chapterContents.content
    })
      .from(chapterContents)
      .where(like(chapterContents.content, `%${pattern}%`));

    // Get book names for display
    const bookList = await db.select().from(books);
    const bookMap = new Map(bookList.map(b => [b.id, b.amharicName || b.englishName]));

    // Process results to find line numbers
    const matches = results.map(chapter => {
      const lines = chapter.content?.split('\n') || [];
      let lineNumber = 1;
      let matchedText = '';
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(pattern)) {
          lineNumber = i + 1;
          matchedText = lines[i];
          break;
        }
      }

      return {
        bookId: chapter.bookId,
        bookName: bookMap.get(chapter.bookId) || `Book ${chapter.bookId}`,
        chapterNumber: chapter.chapterNumber,
        matchedText,
        lineNumber
      };
    });

    return {
      success: true,
      matches
    };

  } catch (error) {
    console.error('Error searching chapters:', error);
    return {
      success: false,
      error: 'Search failed',
      matches: []
    };
  }
}


/**
 * Server action: Get all available chapters for a book
 */
export async function getAvailableChapters(bookId: number) {
  try {
    const chapters = await db.select({
      chapterNumber: chapterContents.chapterNumber,
      verified: chapterContents.verified
    })
      .from(chapterContents)
      .where(eq(chapterContents.bookId, bookId))
      .orderBy(chapterContents.chapterNumber);

    return {
      success: true,
      data: chapters
    };

  } catch (error) {
    console.error('Error fetching book chapters:', error);
    return {
      success: false,
      error: 'Failed to fetch book chapters',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
