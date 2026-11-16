import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Lightweight data-fetching hook.
 * Returns { data, loading, error, refetch }.
 *
 * Calls `fetcher` on mount and whenever `deps` change. Every call takes a
 * generation number from one shared ref, and only the newest generation may
 * write state — so a slow earlier response cannot overwrite a later one, and
 * nothing is written after unmount.
 *
 * (Previously each call made its own counter object, so `refetch` could not
 * invalidate the request it was replacing and unmount invalidated only the
 * first one.)
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (gen === generation.current) setData(result);
    } catch (e: unknown) {
      if (gen === generation.current) {
        setError(e instanceof Error ? e.message : 'Fetch failed');
      }
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    return () => { generation.current++; }; // invalidate on unmount / dep change
  }, [load]);

  return { data, loading, error, refetch: load };
}
