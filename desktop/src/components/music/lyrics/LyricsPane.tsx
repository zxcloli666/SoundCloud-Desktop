import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardPaste, Loader2, MicVocal, RotateCcw, Search } from '../../../lib/icons';
import { isLocalUrn } from '../../../lib/local-library';
import { getLyricsByTrack } from '../../../lib/lyrics';
import type { Track } from '../../../stores/player';
import { type AttachTab, LyricsAttach } from './LyricsAttach';
import { LyricsBar } from './LyricsBar';
import { OffsetSyncedLyrics } from './LyricsOffsetControl';
import { PlainLyrics } from './SyncedLyrics';

const PENDING_POLL_FAST_MS = 3_000;
const PENDING_POLL_SLOW_MS = 10_000;
const PENDING_FAST_WINDOW_MS = 30_000;
const PENDING_POLL_LIMIT_MS = 180_000;

function pendingPollDelay(waitedMs: number): number | false {
  if (waitedMs >= PENDING_POLL_LIMIT_MS) return false;
  return waitedMs < PENDING_FAST_WINDOW_MS ? PENDING_POLL_FAST_MS : PENDING_POLL_SLOW_MS;
}

const primaryButton =
  'h-9 px-4 flex items-center gap-1.5 rounded-full text-[13px] font-semibold bg-accent text-accent-contrast hover:bg-accent-hover transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
const quietButton =
  'h-9 px-4 flex items-center gap-1.5 rounded-full text-[13px] font-semibold text-ink-60 bg-ink/[0.06] hover:bg-ink/[0.12] hover:text-ink transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

const LyricsMessage = ({
  title,
  hint,
  onAttach,
  onRetry,
}: {
  title: string;
  hint: string;
  onAttach?: (tab: AttachTab) => void;
  onRetry?: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-12 text-center">
      <MicVocal size={40} className="text-ink-6" />
      <p className="text-[15px] text-ink-30 font-medium">{title}</p>
      {hint && <p className="text-[12px] text-ink-15 leading-relaxed max-w-[300px]">{hint}</p>}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
        {onRetry && (
          <button type="button" onClick={onRetry} className={primaryButton}>
            <RotateCcw size={14} />
            {t('common.retry')}
          </button>
        )}
        {onAttach && (
          <button
            type="button"
            onClick={() => onAttach('find')}
            className={onRetry ? quietButton : primaryButton}
          >
            <Search size={14} />
            {t('lyricsOwn.find')}
          </button>
        )}
        {onAttach && (
          <button type="button" onClick={() => onAttach('paste')} className={quietButton}>
            <ClipboardPaste size={14} />
            {t('lyricsOwn.paste')}
          </button>
        )}
      </div>
    </div>
  );
};

export const LyricsPane = React.memo(({ track }: { track: Track }) => {
  const { t } = useTranslation();
  const [attach, setAttach] = useState<AttachTab | null>(null);
  const [pollStartedAt, setPollStartedAt] = useState(() => Date.now());
  const local = isLocalUrn(track.urn);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on track switch
  useEffect(() => {
    setAttach(null);
    setPollStartedAt(Date.now());
  }, [track.urn]);

  const {
    data: lyrics,
    dataUpdatedAt,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['lyrics', 'track', track.urn],
    queryFn: () => (local ? Promise.resolve(null) : getLyricsByTrack(track.urn)),
    staleTime: (query) => (query.state.data?.status === 'pending' ? 0 : Number.POSITIVE_INFINITY),
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' && query.state.status !== 'error'
        ? pendingPollDelay(query.state.dataUpdatedAt - pollStartedAt)
        : false,
    retry: 1,
  });

  const close = useCallback(() => setAttach(null), []);
  const onAttach = local ? undefined : setAttach;
  const pending = lyrics?.status === 'pending';
  const polling = pending && !isError && pendingPollDelay(dataUpdatedAt - pollStartedAt) !== false;

  const retry = () => {
    setPollStartedAt(Date.now());
    void refetch();
  };

  const edit = () => setAttach(lyrics?.own && !lyrics.lrclibId ? 'paste' : 'find');

  if (attach) {
    return (
      <LyricsAttach
        track={track}
        lyrics={lyrics ?? null}
        tab={attach}
        onTab={setAttach}
        onClose={close}
      />
    );
  }

  if (lyrics?.synced && lyrics.synced.length > 0) {
    return (
      <OffsetSyncedLyrics urn={track.urn} lines={lyrics.synced} lyrics={lyrics} onEdit={edit} />
    );
  }

  if (lyrics?.plain) {
    return (
      <>
        <LyricsBar urn={track.urn} lyrics={lyrics} onEdit={edit} />
        <PlainLyrics text={lyrics.plain} />
      </>
    );
  }

  if (isFetching || polling) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-ink-15" />
        <p className="text-[13px] text-ink-25">{t('track.lyricsLoading')}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <LyricsMessage
        title={t('track.lyricsLoadError')}
        hint={t('track.lyricsLoadErrorHint')}
        onAttach={onAttach}
        onRetry={retry}
      />
    );
  }

  if (pending) {
    return (
      <LyricsMessage
        title={t('track.lyricsPending')}
        hint={t('track.lyricsPendingHint')}
        onAttach={onAttach}
        onRetry={retry}
      />
    );
  }

  return (
    <LyricsMessage
      title={t('track.lyricsNotFound')}
      hint={local ? '' : t('track.lyricsNotFoundHint')}
      onAttach={onAttach}
    />
  );
});
