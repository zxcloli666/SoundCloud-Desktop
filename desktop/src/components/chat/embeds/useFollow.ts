import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';

export function useFollow(userUrn: string, visible: boolean) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user?.urn ?? null);
  const queryKey = ['following', me, userUrn];
  const { data: following = false } = useQuery({
    queryKey,
    queryFn: () =>
      api<boolean>(`/users/${encodeURIComponent(me!)}/followings/${encodeURIComponent(userUrn)}`),
    enabled: visible && !!me && !!userUrn && me !== userUrn,
  });

  const toggle = async () => {
    const next = !following;
    qc.setQueryData(queryKey, next);
    try {
      await api(`/me/followings/${encodeURIComponent(userUrn)}`, {
        method: next ? 'PUT' : 'DELETE',
      });
      void qc.invalidateQueries({ queryKey: ['user', userUrn] });
      void qc.invalidateQueries({ queryKey: ['me', 'followings'] });
    } catch {
      qc.setQueryData(queryKey, !next);
    }
  };

  return { following, self: me === userUrn, toggle };
}
