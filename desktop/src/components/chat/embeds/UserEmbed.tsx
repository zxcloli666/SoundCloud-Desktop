import { useQuery } from '@tanstack/react-query';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../../../lib/api';
import { UserPlus } from '../../../lib/chat/icons';
import { openShare } from '../../../lib/chat/share';
import { ink } from '../../../lib/chat/tone';
import type { Embed } from '../../../lib/chat/types';
import { fc } from '../../../lib/formatters';
import type { UserProfile } from '../../../lib/hooks';
import { Check, Loader2, Play, Send, User } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { linkRoute } from '../../../lib/soundcloudLink';
import { Avatar } from '../../ui/Avatar';
import { EmbedAction } from './EmbedAction';
import { EmbedShell } from './EmbedShell';
import { useCoverTint } from './useCoverTint';
import { useFollow } from './useFollow';
import { useInView } from './useInView';
import { playUserTop } from './user-top-track';

const PROFILE_STALE_MS = 10 * 60_000;

interface UserEmbedProps {
  embed: Embed;
  mine: boolean;
  compact: boolean;
}

function useProfile(urn: string, visible: boolean): UserProfile | null {
  const { data } = useQuery({
    queryKey: ['user', urn],
    queryFn: () => api<UserProfile>(`/users/${encodeURIComponent(urn)}`),
    enabled: visible && !!urn,
    staleTime: PROFILE_STALE_MS,
  });
  return data ?? null;
}

export const UserEmbed = memo(function UserEmbed({ embed, mine, compact }: UserEmbedProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perf = usePerfMode();
  const [ref, visible] = useInView<HTMLDivElement>();
  const profile = useProfile(embed.urn, visible && !compact);
  const { following, self, toggle } = useFollow(embed.urn, visible && !compact);
  const [starting, setStarting] = useState(false);
  const avatar = profile?.avatar_url ?? embed.artworkUrl;
  const tint = useCoverTint(avatar, visible && perf.bloom && !compact);
  const route = linkRoute(embed.urn);
  const followers = profile?.followers_count;

  const playTop = async () => {
    setStarting(true);
    const started = await playUserTop(embed.urn);
    setStarting(false);
    if (!started) toast(t('chat.embeds.user.noTracks'));
  };

  return (
    <EmbedShell
      kind={embed.kind}
      ref={ref}
      tint={tint}
      mine={mine}
      compact={compact}
      label={embed.title}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          disabled={!route}
          onClick={() => route && navigate(route)}
          aria-label={t('chat.embeds.open')}
          className="relative shrink-0 rounded-full cursor-pointer disabled:cursor-default"
          style={{ boxShadow: `0 0 0 2px ${ink(8)}, 0 8px 20px rgba(0,0,0,0.4)` }}
        >
          <Avatar src={avatar} size={compact ? 40 : 52} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <User size={12} className="shrink-0 text-ink-35" />
            <button
              type="button"
              disabled={!route}
              onClick={() => route && navigate(route)}
              className="min-w-0 truncate text-left text-[13.5px] font-semibold leading-tight text-ink-92 cursor-pointer hover:text-ink disabled:cursor-default"
            >
              {profile?.username ?? embed.title}
            </button>
          </span>
          {followers != null ? (
            <span className="truncate text-[12px] tabular-nums text-ink-50">
              {t('chat.embeds.user.followers', { count: followers, value: fc(followers) })}
            </span>
          ) : (
            embed.artist && <span className="truncate text-[12px] text-ink-50">{embed.artist}</span>
          )}
        </div>
        {!compact && !self && (
          <button
            type="button"
            onClick={() => void toggle()}
            aria-pressed={following}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-all duration-300 cursor-pointer active:scale-[0.97] ${
              following
                ? 'bg-ink/[0.06] text-ink-70 hover:text-ink'
                : 'bg-white text-black hover:scale-[1.03]'
            }`}
          >
            {following ? <Check size={13} /> : <UserPlus size={13} />}
            <span className="hidden @3xs:inline">
              {following ? t('chat.embeds.user.following') : t('chat.embeds.user.follow')}
            </span>
          </button>
        )}
      </div>
      {!compact && (
        <div className="mt-2.5 flex items-center gap-1">
          <button
            type="button"
            disabled={starting}
            onClick={() => void playTop()}
            className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold text-ink-80 transition-colors duration-200 cursor-pointer hover:bg-ink/[0.1] hover:text-ink disabled:cursor-default"
            style={{ background: 'var(--color-bg-glass-hover)' }}
          >
            {starting ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Play size={10} fill="currentColor" strokeWidth={0} />
            )}
            {t('chat.embeds.user.top')}
          </button>
          <div className="ml-auto flex items-center gap-0.5">
            <EmbedAction
              icon={<Send size={14} />}
              label={t('chat.embeds.share.action')}
              onClick={() => openShare(embed)}
            />
          </div>
        </div>
      )}
    </EmbedShell>
  );
});
