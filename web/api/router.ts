import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app.js';

/**
 * Every /api/* request enters the Express app (server/app.ts) as a single
 * Vercel Function. See that file for why the API is not split per route.
 *
 * vercel.json rewrites /api/<anything> to this function and passes the
 * original path as ?__path=<anything>. (This used to be a catch-all file,
 * api/[...path].ts. Outside Next.js that only matched one path segment:
 * /api/health reached the function, /api/readings/today got the platform's
 * NOT_FOUND.)
 *
 * The .js extension on the import is required — and on every relative import
 * under server/ and services/ that this pulls in. Vercel compiles these to
 * ESM, where extensionless relative specifiers do not resolve at runtime even
 * though tsc accepts them under moduleResolution "bundler".
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  // Express routes on req.url, so it has to carry the path the caller used.
  const url = new URL(req.url ?? '/', 'http://localhost');
  const fromQuery = url.searchParams.get('__path') ?? (typeof req.query.__path === 'string' ? req.query.__path : null);
  url.searchParams.delete('__path');
  const search = url.searchParams.toString();

  const path = fromQuery !== null
    ? '/api/' + fromQuery.replace(/^\/+/, '')
    : url.pathname; // called directly, without the rewrite
  req.url = path + (search ? `?${search}` : '');

  return (app as unknown as (rq: VercelRequest, rs: VercelResponse) => void)(req, res);
}
