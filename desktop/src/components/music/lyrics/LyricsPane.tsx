import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MicVocal, Search, Sparkles } from '../../../lib/icons';
import {
  getLyricsByTrack,
  requestLyricsTranscription,
  searchLyricsManual,
} from '../../../lib/lyrics';
import { RequestTimeoutError } from '../../../lib/request-timeout';
import { getTrackDisplay } from '../../../lib/track-display';
import type { Track } from '../../../stores/player';
import { LyricsSourceBadge, PlainLyrics, SyncedLyrics } from './SyncedLyrics';

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
          placeholder={t('track.artistPlaceholder')}
          autoFocus
          className="w-full max-w-[280px] bg-white/10 px-4 py-2.5 rounded-xl text-white text-[14px] outline-none border border-transparent focus:border-white/20 placeholder:text-white/30"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('track.titlePlaceholder')}
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

export const LyricsPane = React.memo(({ track }: { track: Track }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [manualQuery, setManualQuery] = useState<{ artist: string; title: string } | null>(null);
  const [transcriptionAttempt, setTranscriptionAttempt] = useState(0);
  const transcriptionRequested = transcriptionAttempt > 0;
  const display = getTrackDisplay(track);
  const artist = display.artistLine || track.user.username;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on track switch
  useEffect(() => {
    setManualQuery(null);
    setIsEditing(false);
    setTranscriptionAttempt(0);
  }, [track.urn]);

  const {
    data: lyrics,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: manualQuery
      ? ['lyrics', 'search', manualQuery.artist, manualQuery.title, track.duration]
      : transcriptionRequested
        ? ['lyrics', 'transcription', track.urn, transcriptionAttempt]
        : ['lyrics', 'track', track.urn],
    queryFn: ({ signal }) =>
      manualQuery
        ? searchLyricsManual(manualQuery.artist, manualQuery.title, track.duration, signal)
        : transcriptionRequested
          ? requestLyricsTranscription(
              {
                scTrackId: track.urn,
                artist,
                title: display.title,
                durationMs: track.duration,
              },
              signal,
            )
          : getLyricsByTrack(
              {
                scTrackId: track.urn,
                artist,
                title: display.title,
                durationMs: track.duration,
              },
              signal,
            ),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  const startSearch = () => {
    setTranscriptionAttempt(0);
    setIsEditing(true);
    if (!manualQuery) {
      setManualQuery(
        (prev) =>
          prev ?? { artist: display.artistLine || track.user.username, title: display.title },
      );
    }
  };

  if (isEditing) {
    const initialArtist = manualQuery?.artist || artist;
    const initialTitle = manualQuery?.title || display.title;
    return (
      <ManualSearchPanel
        initialArtist={initialArtist}
        initialTitle={initialTitle}
        onCancel={() => setIsEditing(false)}
        onSubmit={(artist, title) => {
          setTranscriptionAttempt(0);
          setManualQuery({ artist, title });
          setIsEditing(false);
        }}
      />
    );
  }

  if (isLoading || (transcriptionRequested && isFetching)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-white/15" />
        <p className="text-[13px] text-white/25">
          {t(transcriptionRequested ? 'track.lyricsTranscribing' : 'track.lyricsLoading')}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-12 text-center relative">
        <button
          type="button"
          onClick={startSearch}
          aria-label={t('track.manualSearch')}
          className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Search size={14} />
        </button>
        <MicVocal size={40} className="text-white/[0.06]" />
        <p className="text-[15px] text-white/30 font-medium">
          {t(
            transcriptionRequested && error instanceof RequestTimeoutError
              ? 'track.lyricsTranscriptionTimeout'
              : transcriptionRequested
                ? 'track.lyricsTranscriptionFailed'
                : 'common.error',
          )}
        </p>
        <button
          type="button"
          disabled={isFetching}
          onClick={() => {
            if (transcriptionRequested) setTranscriptionAttempt((attempt) => attempt + 1);
            else void refetch();
          }}
          className="px-5 py-2 rounded-full text-[13px] font-medium text-white/60 bg-white/10 hover:text-white hover:bg-white/15 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('common.retry')}
        </button>
      </div>
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

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-12 text-center relative">
      <button
        type="button"
        onClick={startSearch}
        aria-label={t('track.manualSearch')}
        className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors cursor-pointer"
      >
        <Search size={14} />
      </button>
      <MicVocal size={40} className="text-white/[0.06]" />
      <p className="text-[15px] text-white/30 font-medium">{t('track.lyricsNotFound')}</p>
      <p className="text-[12px] text-white/15 leading-relaxed max-w-[300px]">
        {t(
          transcriptionRequested
            ? 'track.lyricsTranscriptionUnavailable'
            : 'track.lyricsNotFoundHint',
        )}
      </p>
      <button
        type="button"
        disabled={isFetching}
        onClick={() => {
          setManualQuery(null);
          setTranscriptionAttempt((attempt) => attempt + 1);
        }}
        className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-[13px] font-medium text-white/60 bg-white/[0.08] hover:text-white hover:bg-white/[0.13] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles size={14} />
        {t(transcriptionRequested ? 'track.lyricsTranscribeRetry' : 'track.lyricsTranscribe')}
      </button>
    </div>
  );
});
