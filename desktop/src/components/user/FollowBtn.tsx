import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { type Aura, auraRgba } from '../../lib/aura';
import { Loader2 } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { useAuthStore } from '../../stores/auth';

interface FollowBtnProps {
  userUrn: string;
  aura: Aura;
}

export function FollowBtn({ userUrn, aura }: FollowBtnProps) {
  const { t } = useTranslation();
  const b = usePerfMode().blur(20);
  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: initialFollowing = false, isLoading: isQueryLoading } = useQuery({
    queryKey: ['following', currentUser?.urn, userUrn],
    queryFn: ({ signal }) =>
      api<boolean>(
        `/users/${encodeURIComponent(currentUser!.urn)}/followings/${encodeURIComponent(userUrn)}`,
        { signal },
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
      className={`group relative overflow-hidden inline-flex items-center justify-center gap-2 px-7 h-11 rounded-full text-[13px] font-semibold tracking-wide transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-pointer disabled:opacity-60 ${
        following
          ? 'text-white/80 hover:text-white'
          : 'text-black hover:scale-[1.03] active:scale-[0.97]'
      }`}
      style={{
        background: following
          ? b > 0
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(40,40,46,0.85)'
          : 'linear-gradient(180deg, #ffffff, #e5e7eb)',
        border: following
          ? '0.5px solid rgba(255,255,255,0.12)'
          : '0.5px solid rgba(255,255,255,0.4)',
        boxShadow: following
          ? 'inset 0 0.5px 0 rgba(255,255,255,0.08)'
          : `0 12px 32px ${auraRgba(aura, 0.28)}, inset 0 1px 0 rgba(255,255,255,0.6)`,
        backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
        WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
      }}
    >
      <span
        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
        }}
      />
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
