/**
 * Admin authentication for the API.
 *
 * One shared secret, ADMIN_TOKEN, set in the server environment (Vercel
 * project settings, and web/.env for local dev). The editor sends it as
 * `Authorization: Bearer <token>`.
 *
 * Why this exists: "admin" used to be whichever role a visitor picked during
 * onboarding, and the endpoints that write to the database checked nothing —
 * anyone who found the URL could overwrite Scripture text. The users routes
 * did check, but against an `x-firebase-uid` header the caller supplies, and
 * the first account ever synced was made admin automatically.
 *
 * The rule is default-deny: a request that can change data is refused unless
 * it carries the token. Read-only POSTs are listed explicitly below; a new
 * write route is therefore protected without anyone remembering to protect it.
 */
import { createHash, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/** POST routes that only read or compute — they never write to the database. */
const PUBLIC_POST = new Set([
  '/api/ai/generate',
  '/api/ai/chat-stream',
  '/api/ai/chat',
  '/api/ai/tts',
  '/api/ai/daily-mass',
  '/api/ai/proofread',
  '/api/ai/ocr',
  '/api/chapters/search',
]);

/** GET routes that expose private data and so need the token too. */
const PRIVATE_GET_PREFIXES = ['/api/users'];

const digest = (value: string) => createHash('sha256').update(value).digest();

export function adminConfigured(): boolean {
  return (process.env.ADMIN_TOKEN ?? '').trim().length > 0;
}

/** True when the request carries the configured admin token. */
export function isAdminRequest(req: Pick<Request, 'headers'>): boolean {
  const expected = (process.env.ADMIN_TOKEN ?? '').trim();
  if (!expected) return false;
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const match = /^Bearer\s+(.+)$/i.exec(value ?? '');
  if (!match) return false;
  // Compare digests: equal length for timingSafeEqual, and no early exit that
  // would leak how much of a guess was right.
  return timingSafeEqual(digest(match[1].trim()), digest(expected));
}

/** Does this request need the admin token? Exported for tests. */
export function needsAdmin(method: string, path: string): boolean {
  if (!path.startsWith('/api/')) return false;
  const m = method.toUpperCase();
  const p = path.replace(/\/+$/, '') || '/';
  if (m === 'OPTIONS' || m === 'HEAD') return false;
  if (m === 'GET') return PRIVATE_GET_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'));
  if (m === 'POST') return !PUBLIC_POST.has(p);
  return true; // PUT, PATCH, DELETE and anything else that can mutate
}

/**
 * Express middleware: refuse data-changing requests without the admin token.
 * Mount it before every router.
 */
export function guardWrites(req: Request, res: Response, next: NextFunction) {
  const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
  if (!needsAdmin(req.method, path)) return next();

  if (!adminConfigured()) {
    // Fail closed. An unset token must never mean "open to everyone".
    res.status(503).json({
      success: false,
      code: 'ADMIN_NOT_CONFIGURED',
      error: 'Editing is disabled: ADMIN_TOKEN is not set on the server.',
    });
    return;
  }
  if (!isAdminRequest(req)) {
    res.status(401).json({
      success: false,
      code: 'ADMIN_REQUIRED',
      error: 'Admin passphrase required.',
    });
    return;
  }
  next();
}
