import { useEffect, useState } from 'react';
import { api } from '../../lib/http.ts';

export function useRepostTrack(trackUrn: string, initialCount = 0) {
  const [reposted, setReposted] = useState(false);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  const toggle = async () => {
    const next = !reposted;
    setReposted(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await api(`/reposts/tracks/${encodeURIComponent(trackUrn)}`, {
        method: next ? 'POST' : 'DELETE',
      });
    } catch {
      setReposted(!next);
      setCount((c) => c + (next ? -1 : 1));
    }
  };

  return { reposted, count, toggle };
}
