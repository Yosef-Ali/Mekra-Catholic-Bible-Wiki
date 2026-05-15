import { useState, useEffect, useCallback } from 'react';

/**
 * Lightweight data-fetching hook.
 * Returns { data, loading, error, refetch }.
 *
 * Calls `fetcher` on mount and whenever `deps` change.
 * Unmount-safe — cancels stale requests via a generation counter.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (gen: number, current: { gen: number }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (gen === current.gen) {
        setData(result);
      }
    } catch (e: unknown) {
      if (gen === current.gen) {
        setError(e instanceof Error ? e.message : 'Fetch failed');
      }
    } finally {
      if (gen === current.gen) {
        setLoading(false);
      }
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const current = { gen: 0 };
    load(0, current);
    return () => { current.gen = -1; }; // invalidate on unmount / dep change
  }, [load]);

  const refetch = useCallback(() => {
    const current = { gen: 0 };
    load(0, current);
  }, [load]);

  return { data, loading, error, refetch };
}
