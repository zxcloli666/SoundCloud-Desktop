import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/http.ts';

export function useTrackLike(
  trackUrn: string | undefined,
  initialLiked = false,
  initialCount?: number,
) {
  const qc = useQueryClient();
  const [isLiked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount ?? 0);

  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  useEffect(() => {
    if (initialCount == null) return;
    setCount(initialCount);
  }, [initialCount]);

  const toggle = async () => {
    if (!trackUrn) return;
    const next = !isLiked;
    setLiked(next);
    if (initialCount != null) {
      setCount((c) => c + (next ? 1 : -1));
    }
    try {
      await api(`/likes/tracks/${encodeURIComponent(trackUrn)}`, {
        method: next ? 'POST' : 'DELETE',
      });
      qc.invalidateQueries({ queryKey: ['track', trackUrn], exact: true });
      qc.invalidateQueries({ queryKey: ['track', trackUrn, 'favoriters'] });
      qc.invalidateQueries({ queryKey: ['me', 'likes', 'tracks'] });
    } catch {
      setLiked(!next);
      if (initialCount != null) {
        setCount((c) => c + (next ? -1 : 1));
      }
    }
  };

  return { isLiked, liked: isLiked, count, toggle };
}
