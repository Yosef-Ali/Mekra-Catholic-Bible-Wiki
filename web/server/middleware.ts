import type { Connect } from 'vite';
import { getAllBooks, getBookById, getBooksBySection, searchBooks } from './api/books';
import { getChapterContent, getAvailableChapters, updateChapterContent, searchChapters } from './api/chapters';
import { proofreadContent, extractTextFromImage, chatWithAI } from './api/ai';
import { syncUser, getAllUsers, updateUserRole, isUserAdmin } from './api/users';

// Helper to parse request body
async function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Vite server middleware to handle API routes
export function apiMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    // Only handle API routes
    if (!req.url?.startsWith('/api/')) {
      return next();
    }

    // Set JSON response headers
    res.setHeader('Content-Type', 'application/json');

    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;

      // Books routes
      if (pathname === '/api/books' && req.method === 'GET') {
        const result = await getAllBooks();
        return res.end(JSON.stringify(result));
      }

      if (pathname.startsWith('/api/books/') && req.method === 'GET') {
        const parts = pathname.split('/');

        // /api/books/:id
        if (parts.length === 4 && !isNaN(Number(parts[3]))) {
          const id = parseInt(parts[3]);
          const result = await getBookById(id);
          return res.end(JSON.stringify(result));
        }

        // /api/books/section/:section
        if (parts.length === 5 && parts[3] === 'section') {
          const section = parts[4] as 'OT' | 'NT' | 'Apocrypha';
          if (['OT', 'NT', 'Apocrypha'].includes(section)) {
            const result = await getBooksBySection(section);
            return res.end(JSON.stringify(result));
          }
        }

        // /api/books/search?q=query
        if (parts[3] === 'search') {
          const query = url.searchParams.get('q');
          if (query) {
            const result = await searchBooks(query);
            return res.end(JSON.stringify(result));
          }
        }
      }


      // Chapter routes - GET
      if (pathname.startsWith('/api/chapters/') && req.method === 'GET') {
        const parts = pathname.split('/');

        // /api/chapters/:bookId/:chapterNumber
        if (parts.length === 5 && !isNaN(Number(parts[3])) && !isNaN(Number(parts[4]))) {
          const bookId = parseInt(parts[3]);
          const chapterNumber = parseInt(parts[4]);
          const result = await getChapterContent(bookId, chapterNumber);
          return res.end(JSON.stringify(result));
        }

        // /api/chapters/book/:bookId
        if (parts.length === 5 && parts[3] === 'book' && !isNaN(Number(parts[4]))) {
          const bookId = parseInt(parts[4]);
          const result = await getAvailableChapters(bookId);
          return res.end(JSON.stringify(result));
        }
      }

      // Chapter routes - PUT (update)
      if (pathname.startsWith('/api/chapters/') && req.method === 'PUT') {
        const parts = pathname.split('/');

        // /api/chapters/:bookId/:chapterNumber
        if (parts.length === 5 && !isNaN(Number(parts[3])) && !isNaN(Number(parts[4]))) {
          const bookId = parseInt(parts[3]);
          const chapterNumber = parseInt(parts[4]);
          const body = await parseBody(req);

          if (!body.content) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ success: false, error: 'Content is required' }));
          }

          const result = await updateChapterContent(bookId, chapterNumber, body.content);
          return res.end(JSON.stringify(result));
        }
      }

      // Chapter routes - POST (search for bulk edit)
      if (pathname === '/api/chapters/search' && req.method === 'POST') {
        const body = await parseBody(req);

        if (!body.pattern) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ success: false, error: 'Search pattern is required' }));
        }

        const result = await searchChapters(body.pattern);
        return res.end(JSON.stringify(result));
      }


      // AI routes - Proofreading
      if (pathname === '/api/ai/proofread' && req.method === 'POST') {
        const body = await parseBody(req);

        if (!body.content) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ success: false, error: 'Content is required' }));
        }

        const result = await proofreadContent(body.content, body.bookName, body.chapter);
        return res.end(JSON.stringify(result));
      }

      // AI routes - OCR (Image to Text)
      if (pathname === '/api/ai/ocr' && req.method === 'POST') {
        const body = await parseBody(req);

        if (!body.image) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ success: false, error: 'Image data is required' }));
        }

        const result = await extractTextFromImage(body.image, body.bookName, body.chapter);
        return res.end(JSON.stringify(result));
      }

      // AI routes - Chat Assistant
      if (pathname === '/api/ai/chat' && req.method === 'POST') {
        const body = await parseBody(req);

        if (!body.message) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ success: false, error: 'Message is required' }));
        }

        const context = {
          content: body.content,
          bookName: body.bookName,
          chapter: body.chapter
        };

        const result = await chatWithAI(body.message, context, body.history || []);
        return res.end(JSON.stringify(result));
      }

      // User routes - Sync
      if (pathname === '/api/users/sync' && req.method === 'POST') {
        const body = await parseBody(req);
        try {
          const result = await syncUser(body);
          return res.end(JSON.stringify(result));
        } catch (error: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ success: false, error: error.message }));
        }
      }

      // User routes - List (Admin only)
      if (pathname === '/api/users' && req.method === 'GET') {
        const adminUid = req.headers['x-firebase-uid'] as string;
        try {
          if (!await isUserAdmin(adminUid)) {
            res.statusCode = 403;
            return res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
          }
          const result = await getAllUsers();
          return res.end(JSON.stringify(result));
        } catch (error: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ success: false, error: error.message }));
        }
      }

      // User routes - Update Role (Admin only)
      if (pathname.startsWith('/api/users/') && pathname.endsWith('/role') && req.method === 'PUT') {
        const parts = pathname.split('/');
        // /api/users/:id/role
        if (parts.length === 5 && !isNaN(Number(parts[3]))) {
          const userId = parseInt(parts[3]);
          const adminUid = req.headers['x-firebase-uid'] as string;

          try {
            if (!await isUserAdmin(adminUid)) {
              res.statusCode = 403;
              return res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
            }

            const body = await parseBody(req);
            const result = await updateUserRole(userId, body.role);
            return res.end(JSON.stringify(result));
          } catch (error: any) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ success: false, error: error.message }));
          }
        }
      }

      // Health check
      if (pathname === '/api/health' && req.method === 'GET') {
        return res.end(JSON.stringify({
          success: true,
          message: 'Fana Catholic Bible API is running',
          timestamp: new Date().toISOString()
        }));
      }

      // Route not found
      res.statusCode = 404;
      return res.end(JSON.stringify({
        success: false,
        error: 'API route not found'
      }));

    } catch (error) {
      console.error('API Error:', error);
      res.statusCode = 500;
      return res.end(JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };
}
