import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/http.ts';
import { useAuthStore } from '../../stores/auth.ts';

export function useFollowUser(userUrn: string) {
  const currentUserUrn = useAuthStore((s) => s.user?.urn);
  const qc = useQueryClient();

  const { data: initialFollowing = false, isLoading: isQueryLoading } = useQuery({
    queryKey: ['following', currentUserUrn, userUrn],
    queryFn: () =>
      api<boolean>(
        `/users/${encodeURIComponent(currentUserUrn!)}/followings/${encodeURIComponent(userUrn)}`,
      ),
    enabled: !!currentUserUrn && !!userUrn,
  });

  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  const toggle = async () => {
    const next = !following;
    setLoading(true);
    setFollowing(next);
    try {
      await api(`/me/followings/${encodeURIComponent(userUrn)}`, {
        method: next ? 'PUT' : 'DELETE',
      });
      qc.invalidateQueries({ queryKey: ['following', currentUserUrn, userUrn] });
      qc.invalidateQueries({ queryKey: ['user', userUrn] });
      qc.invalidateQueries({ queryKey: ['me', 'followings'] });
    } catch {
      setFollowing(!next);
    } finally {
      setLoading(false);
    }
  };

  return {
    following,
    loading: loading || isQueryLoading,
    toggle,
  };
}
