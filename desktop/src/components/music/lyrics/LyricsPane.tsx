import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MicVocal, Search } from '../../../lib/icons';
import { getLyricsByTrack, searchLyricsManual } from '../../../lib/lyrics';
import { getTrackDisplay } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';
import { LyricsSourceBadge, PlainLyrics, SyncedLyrics } from './SyncedLyrics';

const PENDING_POLL_FAST_MS = 3_000;
const PENDING_POLL_SLOW_MS = 10_000;
const PENDING_FAST_WINDOW_MS = 30_000;
const PENDING_POLL_LIMIT_MS = 180_000;

function pendingPollDelay(waitedMs: number): number | false {
  if (waitedMs >= PENDING_POLL_LIMIT_MS) return false;
  return waitedMs < PENDING_FAST_WINDOW_MS ? PENDING_POLL_FAST_MS : PENDING_POLL_SLOW_MS;
}

const ManualSearchPanel = React.memo(
  ({
    initialArtist,
    initialTitle,
    onCancel,
    onSubmit,
  }: {
    initialArtist: string;
    initialTitle: string;
    onCancel: () => void;
    onSubmit: (artist: string, title: string) => void;
  }) => {
    const { t } = useTranslation();
    const [artist, setArtist] = useState(initialArtist);
    const [title, setTitle] = useState(initialTitle);

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-12 animate-fade-in-up">
        <h3 className="text-white/80 font-bold mb-2">{t('track.manualSearch')}</h3>
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist"
          autoFocus
          className="w-full max-w-[280px] bg-white/10 px-4 py-2.5 rounded-xl text-white text-[14px] outline-none border border-transparent focus:border-white/20 placeholder:text-white/30"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && artist.trim() && title.trim()) {
              onSubmit(artist.trim(), title.trim());
            }
          }}
          className="w-full max-w-[280px] bg-white/10 px-4 py-2.5 rounded-xl text-white text-[14px] outline-none border border-transparent focus:border-white/20 placeholder:text-white/30"
        />
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-full text-[13px] font-medium text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {t('common.back')}
          </button>
          <button
            type="button"
            disabled={!artist.trim() || !title.trim()}
            onClick={() => onSubmit(artist.trim(), title.trim())}
            className="px-6 py-2 rounded-full text-[13px] font-bold bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('track.search')}
          </button>
        </div>
      </div>
    );
  },
);

const LyricsMessage = ({
  title,
  hint,
  onSearch,
  onRetry,
}: {
  title: string;
  hint: string;
  onSearch: () => void;
  onRetry?: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-12 text-center relative">
      <button
        type="button"
        onClick={onSearch}
        aria-label={t('track.manualSearch')}
        className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Search size={14} />
      </button>
      <MicVocal size={40} className="text-white/[0.06]" />
      <p className="text-[15px] text-white/30 font-medium">{title}</p>
      <p className="text-[12px] text-white/15 leading-relaxed max-w-[300px]">{hint}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-5 py-2 rounded-full text-[13px] font-medium text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
};

export const LyricsPane = React.memo(({ track }: { track: Track }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [manualQuery, setManualQuery] = useState<{ artist: string; title: string } | null>(null);
  const [pollStartedAt, setPollStartedAt] = useState(() => Date.now());

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on track switch
  useEffect(() => {
    setManualQuery(null);
    setIsEditing(false);
    setPollStartedAt(Date.now());
  }, [track.urn]);

  const {
    data: lyrics,
    dataUpdatedAt,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: manualQuery
      ? ['lyrics', 'search', manualQuery.artist, manualQuery.title, track.duration]
      : ['lyrics', 'track', track.urn],
    queryFn: () =>
      manualQuery
        ? searchLyricsManual(manualQuery.artist, manualQuery.title, track.duration)
        : getLyricsByTrack(track.urn),
    staleTime: (query) => (query.state.data?.status === 'pending' ? 0 : Number.POSITIVE_INFINITY),
    refetchInterval: (query) =>
      query.state.data?.status === 'pending'
        ? pendingPollDelay(query.state.dataUpdatedAt - pollStartedAt)
        : false,
    retry: 1,
  });

  const pending = lyrics?.status === 'pending';
  const polling = pending && pendingPollDelay(dataUpdatedAt - pollStartedAt) !== false;

  const retry = () => {
    setPollStartedAt(Date.now());
    void refetch();
  };

  const startSearch = () => {
    const display = getTrackDisplay(track);
    setIsEditing(true);
    if (!manualQuery) {
      setManualQuery(
        (prev) =>
          prev ?? { artist: display.artistLine || track.user.username, title: display.title },
      );
    }
  };

  if (isEditing) {
    const display = getTrackDisplay(track);
    const initialArtist = manualQuery?.artist || display.artistLine || track.user.username;
    const initialTitle = manualQuery?.title || display.title;
    return (
      <ManualSearchPanel
        initialArtist={initialArtist}
        initialTitle={initialTitle}
        onCancel={() => setIsEditing(false)}
        onSubmit={(artist, title) => {
          setManualQuery({ artist, title });
          setIsEditing(false);
        }}
      />
    );
  }

  if (lyrics?.synced && lyrics.synced.length > 0) {
    return (
      <>
        <LyricsSourceBadge source={lyrics.source} onSearch={startSearch} />
        <SyncedLyrics lines={lyrics.synced} />
      </>
    );
  }

  if (lyrics?.plain) {
    return (
      <>
        <LyricsSourceBadge source={lyrics.source} onSearch={startSearch} />
        <PlainLyrics text={lyrics.plain} />
      </>
    );
  }

  if (isFetching || polling) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-white/15" />
        <p className="text-[13px] text-white/25">{t('track.lyricsLoading')}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <LyricsMessage
        title={t('track.lyricsLoadError')}
        hint={t('track.lyricsLoadErrorHint')}
        onSearch={startSearch}
        onRetry={retry}
      />
    );
  }

  if (pending) {
    return (
      <LyricsMessage
        title={t('track.lyricsPending')}
        hint={t('track.lyricsPendingHint')}
        onSearch={startSearch}
        onRetry={retry}
      />
    );
  }

  return (
    <LyricsMessage
      title={t('track.lyricsNotFound')}
      hint={t('track.lyricsNotFoundHint')}
      onSearch={startSearch}
    />
  );
});
