import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { Loader2 } from '../../lib/icons';
import { useAuthStore } from '../../stores/auth';

interface FollowBtnProps {
  userUrn: string;
}

export function FollowBtn({ userUrn }: FollowBtnProps) {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: initialFollowing = false, isLoading: isQueryLoading } = useQuery({
    queryKey: ['following', currentUser?.urn, userUrn],
    queryFn: () =>
      api<boolean>(
        `/users/${encodeURIComponent(currentUser!.urn)}/followings/${encodeURIComponent(userUrn)}`,
      ),
    enabled: !!currentUser?.urn && !!userUrn,
  });

  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  const toggle = async () => {
    setLoading(true);
    const next = !following;
    setFollowing(next);
    try {
      await api(`/me/followings/${encodeURIComponent(userUrn)}`, {
        method: next ? 'PUT' : 'DELETE',
      });
      qc.invalidateQueries({ queryKey: ['following', currentUser?.urn, userUrn] });
      qc.invalidateQueries({ queryKey: ['user', userUrn] });
      // Cold-кеш `/me/followings` живёт с staleTime: Infinity — invalidate
      // обязателен, иначе UI не покажет нового follow/unfollow до перезапуска.
      qc.invalidateQueries({ queryKey: ['me', 'followings'] });
    } catch {
      setFollowing(!next);
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || isQueryLoading;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-7 text-[13px] font-semibold transition-colors duration-200 disabled:opacity-60 ${
        following
          ? 'border border-ink/[0.14] bg-ink/[0.06] text-ink-80 hover:bg-ink/[0.1] hover:text-ink'
          : 'bg-accent text-accent-contrast hover:bg-accent-hover'
      }`}
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : following ? (
        t('user.following')
      ) : (
        t('user.follow')
      )}
    </button>
  );
}
