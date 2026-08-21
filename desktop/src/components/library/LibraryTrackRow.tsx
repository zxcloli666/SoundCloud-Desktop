import React from 'react';
import { useTranslation } from 'react-i18next';
import { preloadTrack } from '../../lib/audio';
import { art, dur, fc } from '../../lib/formatters';
import {
  headphones11,
  heart11,
  ListMusic,
  ListPlus,
  Music,
  pauseWhite14,
  playWhite14,
} from '../../lib/icons';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { usePlayerStore } from '../../stores/player';
import { AddToPlaylistDialog } from '../music/AddToPlaylistDialog';
import { LikeButton } from '../music/LikeButton';
import { sameScdMeta, TrackStatusBadges } from '../music/TrackStatusBadges';
import { TrackTitleArtist } from '../music/TrackTitleArtist';

export const LibraryTrackRow = React.memo(
  function LibraryTrackRow({
    track,
    index,
    queue,
    onPlay,
  }: {
    track: Track;
    index: number;
    queue: Track[];
    onPlay?: () => void;
  }) {
    const { t } = useTranslation();
    const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue, onPlay);
    const addToQueueNext = usePlayerStore((s) => s.addToQueueNext);

    const handleAddToQueue = (e: React.MouseEvent) => {
      e.stopPropagation();
      addToQueueNext([track]);
    };

    const cover = art(track.artwork_url, 't200x200');

    return (
      <div
        className={`sonveil-collection-track-row group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 ease-[var(--ease-apple)] ${
          isThis
            ? 'is-current bg-accent/[0.06] ring-1 ring-accent/20 shadow-[inset_0_0_20px_rgba(255,85,0,0.05)]'
            : 'hover:bg-white/[0.04]'
        }`}
      >
        <div
          className="w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer"
          onClick={togglePlay}
          onMouseEnter={() => preloadTrack(track.urn)}
        >
          {isThisPlaying ? (
            <div className="w-8 h-8 rounded-full bg-accent text-accent-contrast flex items-center justify-center shadow-[0_0_15px_var(--color-accent-glow)] scale-100 animate-fade-in-up">
              {pauseWhite14}
            </div>
          ) : (
            <>
              <span className="text-[13px] text-white/20 tabular-nums font-medium group-hover:hidden">
                {index + 1}
              </span>
              <div className="hidden group-hover:flex w-8 h-8 rounded-full bg-white/10 items-center justify-center hover:bg-white/20 hover:scale-105 transition-all">
                {playWhite14}
              </div>
            </>
          )}
        </div>

        <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] shadow-md">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.05] to-transparent">
              <Music size={14} className="text-white/20" />
            </div>
          )}
        </div>

        <TrackTitleArtist
          track={track}
          highlight={isThis}
          size="md"
          className="flex flex-col justify-center"
        />

        <div className="hidden md:flex shrink-0">
          <TrackStatusBadges meta={track._scd_meta} />
        </div>

        <LikeButton track={track} />

        <AddToPlaylistDialog trackUrns={[track.urn]}>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/[0.08] transition-all duration-200 shrink-0"
            title={t('playlist.addToPlaylist')}
          >
            <ListMusic size={16} />
          </button>
        </AddToPlaylistDialog>

        <button
          type="button"
          onClick={handleAddToQueue}
          className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/[0.08] transition-all duration-200 shrink-0"
          title={t('player.addToQueue')}
        >
          <ListPlus size={16} />
        </button>

        <div className="hidden sm:flex items-center gap-4 shrink-0 pr-4">
          {track.playback_count != null && (
            <span className="text-[11px] text-white/30 tabular-nums flex items-center gap-1.5 w-16">
              {headphones11}
              {fc(track.playback_count)}
            </span>
          )}
          <span className="text-[11px] text-white/30 tabular-nums flex items-center gap-1.5 w-14">
            {heart11}
            {fc(track.favoritings_count ?? track.likes_count)}
          </span>
        </div>

        <span className="text-[12px] text-white/30 tabular-nums font-medium shrink-0 w-12 text-right">
          {dur(track.duration)}
        </span>
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn &&
    prev.index === next.index &&
    prev.track.title === next.track.title &&
    prev.track.enrichment === next.track.enrichment &&
    sameScdMeta(prev.track._scd_meta, next.track._scd_meta),
);
