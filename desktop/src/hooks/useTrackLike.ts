import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api.ts';

export function useTrackLike(trackUrn: string | undefined, initialLiked = false) {
  const qc = useQueryClient();
  const [isLiked, setLiked] = useState(initialLiked);

  useEffect(() => {
    setLiked(initialLiked);
  }, [initialLiked]);

  const toggle = async () => {
    if (!trackUrn) return;
    const next = !isLiked;
    setLiked(next);
    try {
      await api(`/likes/tracks/${encodeURIComponent(trackUrn)}`, {
        method: next ? 'POST' : 'DELETE',
      });
      qc.invalidateQueries({ queryKey: ['track', trackUrn], exact: true });
      qc.invalidateQueries({ queryKey: ['me', 'likes', 'tracks'] });
    } catch (_err) {
      setLiked(!next);
    }
  };

  return { isLiked, toggle };
}
