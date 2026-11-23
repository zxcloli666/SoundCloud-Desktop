import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { forgetOfflineLike } from '../../lib/cache';
import { clearDislike } from '../../lib/dislike-actions';
import { trackTasteWrite } from '../../lib/events';
import { fc } from '../../lib/formatters';
import { invalidateAllLikesCache } from '../../lib/hooks';
import { Check, Download, LinkIcon, Loader2, pauseCurrent16, playCurrent16 } from '../../lib/icons';
import { optimisticToggleLike, setLikedUrn, useLiked } from '../../lib/likes';
import { rememberLikedUrn } from '../../lib/offline-index';
import { cleanPermalink } from '../../lib/permalink';
import { useSuperliked } from '../../lib/superlikes';
import { saveTrackFile } from '../../lib/track-actions';
import type { Track } from '../../stores/player';
import { HoldHeart } from '../music/superlike/HoldHeart';
import { heartTitle } from '../music/superlike/heart-title';
import type { HeartGesture } from '../music/superlike/useHeartGesture';
import { useSuperlikeGesture } from '../music/superlike/useSuperlikeGesture';

const EngagementChip = React.memo(function EngagementChip({
  active,
  icon,
  count,
  label,
  title,
  handlers,
}: {
  active: boolean;
  icon: React.ReactNode;
  count: number;
  label: string;
  title: string;
  handlers: HeartGesture['handlers'];
}) {
  return (
    <button
      type="button"
      {...handlers}
      title={title}
      aria-label={label}
      className={`inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-2xl border px-3.5 text-[12.5px] font-semibold tabular-nums transition-colors duration-200 ${
        active
          ? 'border-accent/30 bg-accent/12 text-accent'
          : 'border-ink/[0.07] bg-ink/[0.04] text-ink-65 hover:border-ink/[0.12] hover:bg-ink/[0.07] hover:text-ink-90'
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
  const superliked = useSuperliked(trackUrn) && liked;
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
    if (next) clearDislike(trackUrn);
    try {
      await trackTasteWrite(
        api(`/likes/tracks/${encodeURIComponent(trackUrn)}`, {
          method: next ? 'POST' : 'DELETE',
        }),
      );
      void (next ? rememberLikedUrn(trackUrn, cached) : forgetOfflineLike(trackUrn));
      qc.invalidateQueries({ queryKey: ['track', trackUrn, 'favoriters'] });
    } catch {
      setLocalCount((c) => c + (next ? -1 : 1));
      if (cached) optimisticToggleLike(qc, cached, !next);
      else setLikedUrn(trackUrn, !next);
    }
  };

  const gesture = useSuperlikeGesture(
    qc.getQueryData<Track>(['track', trackUrn]) ?? { urn: trackUrn },
    () => void toggle(),
  );

  return (
    <EngagementChip
      active={liked}
      icon={<HoldHeart liked={liked} superliked={superliked} size={15} gesture={gesture} />}
      count={localCount}
      label={t('track.likes')}
      title={heartTitle(t, liked, superliked)}
      handlers={gesture.handlers}
    />
  );
});

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
      className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-colors duration-200 ${
        active ? 'bg-accent/15 text-accent' : 'text-ink-60 hover:bg-ink/[0.07] hover:text-ink-95'
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
    navigator.clipboard.writeText(cleanPermalink(url));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? t('auth.copied') : t('auth.copyLink')}
      aria-label={copied ? t('auth.copied') : t('auth.copyLink')}
      className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-colors duration-200 ${
        copied ? 'bg-ok/10 text-ok' : 'text-ink-60 hover:bg-ink/[0.07] hover:text-ink-95'
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
      await saveTrackFile(track);
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
      className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-ink-60 transition-colors duration-200 hover:bg-ink/[0.07] hover:text-ink-95 disabled:opacity-50"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
    </button>
  );
});

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
      className="inline-flex h-11 cursor-pointer items-center gap-3 rounded-full bg-accent pr-5 pl-2 text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-shade-15">
        {isPlaying ? pauseCurrent16 : playCurrent16}
      </span>
      {isPlaying ? t('track.pause') : t('track.play')}
    </button>
  );
});
