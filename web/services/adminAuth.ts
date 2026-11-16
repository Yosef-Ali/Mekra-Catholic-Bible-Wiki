/**
 * Admin passphrase, client side.
 *
 * The passphrase is checked by the server (server/auth.ts) on every request
 * that changes data. Holding it here only decides whether the editing UI is
 * offered — it is a convenience, never the protection itself.
 */

const STORAGE_KEY = 'emmaus_admin_token';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try { localStorage.setItem(STORAGE_KEY, token); } catch { /* private mode */ }
}

export function clearAdminToken(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
}

/** Headers to add to a request that changes data. */
export function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type VerifyResult = 'ok' | 'wrong' | 'not-configured' | 'offline';

/** Ask the server whether a passphrase is the admin passphrase. */
export async function verifyAdminToken(token: string): Promise<VerifyResult> {
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return 'ok';
    if (res.status === 503) return 'not-configured';
    if (res.status === 401) return 'wrong';
    return 'offline';
  } catch {
    return 'offline';
  }
}

/**
 * Turn a refused write into a message a person can act on, and forget a
 * passphrase the server no longer accepts.
 */
export function describeWriteFailure(status: number, fallback: string): string {
  if (status === 401) {
    clearAdminToken();
    return 'Admin passphrase required — unlock the editor in Settings and try again.';
  }
  if (status === 503) {
    return 'Editing is disabled on this server (ADMIN_TOKEN is not set).';
  }
  return fallback;
}
