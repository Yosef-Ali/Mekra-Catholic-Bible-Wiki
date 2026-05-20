import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import booksRouter from './routes/books';
import bookmarksRouter from './routes/bookmarks';
import chaptersRouter from './routes/chapters';
import usersRouter from './routes/users';
import pipelineRouter from './routes/pipeline';
import aiRouter from './routes/ai';
import wikiRouter from './routes/wiki';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve pipeline-workflow.html at /pipeline
app.get('/pipeline', (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'pipeline-workflow.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Fana Catholic Bible API is running'
  });
});

// Routes
app.use('/api/books', booksRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/users', usersRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/ai', aiRouter);
app.use('/api/wiki', wikiRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ API Server running on http://localhost:${PORT}`);
  console.log(`🔧 Pipeline UI: http://localhost:${PORT}/pipeline`);
  console.log(`📖 Books API: http://localhost:${PORT}/api/books`);
  console.log(`🔖 Bookmarks API: http://localhost:${PORT}/api/bookmarks`);
  console.log(`📖 Chapters API: http://localhost:${PORT}/api/chapters`);
});

export default app;
