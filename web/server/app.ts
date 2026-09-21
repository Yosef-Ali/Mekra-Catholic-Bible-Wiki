/**
 * The single Express app — one API definition for the whole project.
 *
 * Mounted three ways, all running this same code:
 *   - Vite dev server   → vite.config.ts calls server.middlewares.use(app)
 *   - `npm run server`  → server/index.ts, a plain listener on :3001
 *   - Vercel            → api/[...path].ts, the whole app as ONE function
 *
 * It is deliberately one function rather than a file per route: Vercel's
 * Hobby plan allows 12 functions per deployment and, outside Next.js, every
 * file under api/ becomes its own function. Splitting this API by route
 * would exceed that cap, and previously meant maintaining the same endpoint
 * twice — once here and once as a Vercel function that silently drifted.
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import pipelineRouter from './routes/pipeline';
import aiRouter from './routes/ai';
import wikiRouter from './routes/wiki';
import { apiMiddleware } from './middleware';

dotenv.config();

const app = express();

app.use(cors());

// @vercel/node parses JSON bodies itself and consumes the request stream, so
// express.json() would sit waiting for 'data' events that never arrive and
// the function would time out. Only parse when nothing has been parsed yet.
// (The same drain-order bug once bit the Vite middleware on PUT requests.)
const jsonParser = express.json({ limit: '4mb' });
app.use((req, res, next) => {
  if ((req as any).body !== undefined) return next();
  return jsonParser(req, res, next);
});

// Pipeline tooling UI
app.get('/pipeline', (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'pipeline-workflow.html'));
});

// Routers
app.use('/api/pipeline', pipelineRouter);
app.use('/api/ai', aiRouter);
app.use('/api/wiki', wikiRouter);

// books, chapters, users, readings and health. This is a connect-style
// middleware, which Express mounts directly — it stays the source of truth
// for these routes because it is what the dev server has always served.
app.use(apiMiddleware());

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err);
  if (res.headersSent) return;
  res.status(500).json({ success: false, error: 'Internal server error', message: err?.message });
});

export default app;
