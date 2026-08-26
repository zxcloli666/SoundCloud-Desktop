import {useQueryClient} from '@tanstack/react-query';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {toast} from 'sonner';
import {api} from '../../lib/api';
import {downloadTrack} from '../../lib/cache';
import {fc} from '../../lib/formatters';
import {invalidateAllLikesCache} from '../../lib/hooks';
import {Check, Download, Heart, LinkIcon, Loader2, pauseCurrent16, playCurrent16,} from '../../lib/icons';
import {commitOptimisticLike, optimisticToggleLike, setLikedUrn, useLiked} from '../../lib/likes';
import {getTrackDisplay} from '../../lib/track-display';
import type {Track} from '../../stores/player';

/** Accent like-chip: icon + count, glows accent when active. */
const EngagementChip = React.memo(function EngagementChip({
  active,
  icon,
  count,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 px-3.5 h-11 rounded-2xl text-[12.5px] font-semibold tabular-nums border transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer active:scale-[0.96] ${
        active
          ? 'bg-accent/15 border-accent/30 text-accent shadow-[0_0_18px_var(--color-accent-glow)]'
          : 'bg-white/[0.04] border-white/[0.07] text-white/65 hover:bg-white/[0.07] hover:text-white/90 hover:border-white/[0.12]'
      }`}
    >
      {icon}
      <span>{fc(count)}</span>
    </button>
  );
});

export const LikeBtn = React.memo(({ trackUrn, count }: { trackUrn: string; count?: number }) => {
  const { t } = useTranslation();
  const liked = useLiked(trackUrn);
  const [localCount, setLocalCount] = useState(count ?? 0);
  const qc = useQueryClient();

  useEffect(() => setLocalCount(count ?? 0), [count]);

  const toggle = async () => {
    const next = !liked;
    setLocalCount((c) => c + (next ? 1 : -1));
    const cached = qc.getQueryData<Track>(['track', trackUrn]);
    if (cached) optimisticToggleLike(qc, cached, next);
    else setLikedUrn(trackUrn, next);
    invalidateAllLikesCache();
    try {
      await api(`/likes/tracks/${encodeURIComponent(trackUrn)}`, {
        method: next ? 'POST' : 'DELETE',
      });
      commitOptimisticLike(trackUrn, next);
      qc.invalidateQueries({ queryKey: ['track', trackUrn, 'favoriters'] });
    } catch {
      setLocalCount((c) => c + (next ? -1 : 1));
      if (cached) optimisticToggleLike(qc, cached, !next, { emitEvent: false });
      else setLikedUrn(trackUrn, !next);
    }
  };

  return (
    <EngagementChip
      active={liked}
      icon={<Heart size={15} fill={liked ? 'currentColor' : 'none'} />}
      count={localCount}
      label={t('track.likes')}
      onClick={toggle}
    />
  );
});

/** Icon-only button for the utility rail. */
export const IconAction = React.memo(function IconAction({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
        active
          ? 'text-accent bg-accent/15'
          : 'text-white/60 hover:text-white/95 hover:bg-white/[0.07]'
      }`}
    >
      {icon}
    </button>
  );
});

export const CopyIconAction = React.memo(function CopyIconAction({ url }: { url?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!url) return null;

  const copy = () => {
    try {
      const u = new URL(url);
      for (const p of ['utm_medium', 'utm_campaign', 'utm_source']) u.searchParams.delete(p);
      navigator.clipboard.writeText(u.toString().replace(/\?$/, ''));
    } catch {
      navigator.clipboard.writeText(url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? t('auth.copied') : t('auth.copyLink')}
      aria-label={copied ? t('auth.copied') : t('auth.copyLink')}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
        copied
          ? 'text-emerald-400 bg-emerald-500/12'
          : 'text-white/60 hover:text-white/95 hover:bg-white/[0.07]'
      }`}
    >
      {copied ? <Check size={16} /> : <LinkIcon size={16} />}
    </button>
  );
});

export const DownloadButton = React.memo(({ track }: { track: Track }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const download = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const display = getTrackDisplay(track);
      await downloadTrack(track.urn, display.artistLine || track.user.username, display.title, {
        artworkUrl: track.artwork_url,
        durationMs: track.duration,
      });
      toast.success(t('track.downloaded'));
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'cancelled') return;
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={loading}
      title={t('track.download')}
      aria-label={t('track.download')}
      className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white/60 hover:text-white/95 hover:bg-white/[0.07] transition-all duration-200 cursor-pointer disabled:opacity-50"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
    </button>
  );
});

/** Big primary play/pause pill — the room's main transport. Uses the user's accent. */
export const PlayPill = React.memo(function PlayPill({
  isPlaying,
  onClick,
}: {
  isPlaying: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden inline-flex items-center gap-2.5 pl-4 pr-6 h-11 rounded-full text-[14px] font-semibold transition-all duration-500 ease-[var(--ease-apple)] cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
        isPlaying ? 'bg-white text-black' : 'bg-accent text-accent-contrast'
      }`}
      style={{
        boxShadow: '0 12px 32px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
      }}
    >
      <span
        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-[var(--ease-apple)] pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
        }}
      />
      {isPlaying ? pauseCurrent16 : playCurrent16}
      {isPlaying ? t('track.pause') : t('track.play')}
    </button>
  );
});
