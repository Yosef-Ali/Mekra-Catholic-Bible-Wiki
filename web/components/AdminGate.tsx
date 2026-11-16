import React, { useEffect, useState } from 'react';
import { getAdminToken, setAdminToken, clearAdminToken, verifyAdminToken, VerifyResult } from '../services/adminAuth';
import { CrossMark, Rubric } from './ui/ManuscriptPrimitives';

/**
 * Shows its children only after the admin passphrase has been accepted by
 * the server. Wrap anything that edits shared content (Scripture text, the
 * daily readings).
 *
 * This is the door, not the lock: the server refuses unauthenticated writes
 * regardless of what the browser renders.
 */
export const AdminGate: React.FC<{ children: React.ReactNode; title?: string }> = ({
  children,
  title = 'Content editor',
}) => {
  const [state, setState] = useState<'checking' | 'locked' | 'open'>(() => (getAdminToken() ? 'checking' : 'locked'));
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<VerifyResult | null>(null);

  // A stored passphrase may have been rotated on the server since last time.
  useEffect(() => {
    const stored = getAdminToken();
    if (!stored) return;
    let cancelled = false;
    verifyAdminToken(stored).then((result) => {
      if (cancelled) return;
      if (result === 'ok') { setState('open'); return; }
      if (result === 'wrong') clearAdminToken();
      setProblem(result === 'wrong' ? null : result);
      setState('locked');
    });
    return () => { cancelled = true; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = value.trim();
    if (!token || busy) return;
    setBusy(true);
    setProblem(null);
    const result = await verifyAdminToken(token);
    setBusy(false);
    if (result === 'ok') {
      setAdminToken(token);
      setValue('');
      setState('open');
    } else {
      setProblem(result);
    }
  };

  if (state === 'open') return <>{children}</>;

  if (state === 'checking') {
    return (
      <div className="py-10 text-center font-mono text-[10px] tracking-[0.14em] uppercase text-ink-soft" role="status">
        Checking access…
      </div>
    );
  }

  const message =
    problem === 'wrong' ? 'That passphrase was not accepted. · የይለፍ ሐረጉ ትክክል አይደለም።'
    : problem === 'not-configured' ? 'Editing is switched off on this server: ADMIN_TOKEN has not been set.'
    : problem === 'offline' ? "Couldn't reach the server. Check your connection and try again."
    : null;

  return (
    <div className="max-w-md mx-auto my-10 p-6" style={{ background: 'var(--cream)', border: '1px solid var(--rule)' }}>
      <div className="flex items-center gap-2 mb-3">
        <CrossMark size={14} />
        <Rubric>{`${title} · locked`}</Rubric>
      </div>
      <p className="font-garamond text-[17px] leading-snug text-ink m-0">
        This area changes content that every reader sees. Enter the admin passphrase to continue.
      </p>
      <p className="font-ethiopic text-[14px] text-ink-mid mt-1 mb-4">ለመቀጠል የአስተዳዳሪ የይለፍ ሐረግ ያስገቡ።</p>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="admin-passphrase" className="sr-only">Admin passphrase</label>
        <input
          id="admin-passphrase"
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Admin passphrase"
          className="flex-1 min-w-0 px-3 py-2 font-sans text-[14px] bg-parchment-light text-ink outline-none focus:ring-2 focus:ring-oxblood/40"
          style={{ border: '1px solid var(--rule)' }}
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="px-4 py-2 font-mono text-[11px] tracking-[0.12em] uppercase bg-oxblood text-parchment disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
      {message && (
        <p className="font-sans text-[13px] text-oxblood mt-3 mb-0" role="alert">{message}</p>
      )}
    </div>
  );
};
