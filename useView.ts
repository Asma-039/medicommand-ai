import { useCallback, useEffect, useState } from 'react';
import { supabase, configured } from './supabase';

export function useView<T>(view: string, orderBy?: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase.from(view).select('*');
    if (orderBy) q = q.order(orderBy);
    const { data, error } = await q;
    if (error) setError(error.message);
    else {
      setError(null);
      setData((data ?? []) as T[]);
    }
    setLoading(false);
  }, [view, orderBy]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
