import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app.js';

/**
 * Catch-all: every /api/* request enters the Express app (server/app.ts) as a
 * single Vercel Function. See that file for why the API is not split per route.
 *
 * The .js extension on the import is required — Vercel compiles these to ESM,
 * where extensionless relative specifiers do not resolve at runtime even
 * though tsc accepts them under moduleResolution "bundler".
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  // Rebuild the original path from the catch-all segments rather than trusting
  // req.url, which the platform may have rewritten. Express routes on req.url,
  // so it has to carry the real path (and query string) it was called with.
  const raw = req.query.path;
  const segments = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const q = req.url?.indexOf('?') ?? -1;
  const search = q >= 0 ? (req.url as string).slice(q) : '';
  req.url = '/api/' + segments.map(encodeURIComponent).join('/') + search;

  return (app as unknown as (rq: VercelRequest, rs: VercelResponse) => void)(req, res);
}
