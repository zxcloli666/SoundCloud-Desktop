import React from 'react';
import { useTranslation } from 'react-i18next';
import { clearDislike, dislikeTrack } from '../../lib/dislike-actions';
import { useDisliked } from '../../lib/dislikes';
import { art, dur } from '../../lib/formatters';
import { Music, pauseWhite14, playWhite14, ThumbsDown } from '../../lib/icons';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { TrackTitleArtist } from '../music/TrackTitleArtist';

export const DislikedTrackRow = React.memo(function DislikedTrackRow({ track }: { track: Track }) {
  const { t } = useTranslation();
  const disliked = useDisliked(track.urn);
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track);
  const cover = art(track.artwork_url, 't200x200');

  const toggleDislike = () => {
    if (disliked) clearDislike(track.urn);
    else void dislikeTrack(track, { undo: false });
  };

  return (
    <div
      className={`group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 ease-[var(--ease-apple)] ${
        isThis
          ? 'bg-accent/[0.06] ring-1 ring-accent/20'
          : disliked
            ? 'hover:bg-white/[0.03]'
            : 'bg-white/[0.03] ring-1 ring-white/[0.06]'
      }`}
    >
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isThisPlaying ? t('track.pause') : t('track.play')}
        className={`relative w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] shadow-md cursor-pointer transition-[filter,opacity] duration-300 ${
          disliked && !isThis
            ? 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'
            : ''
        }`}
      >
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" decoding="async" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.05] to-transparent">
            <Music size={14} className="text-white/20" />
          </div>
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity ${
            isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isThisPlaying ? pauseWhite14 : playWhite14}
        </div>
      </button>

      <div
        className={`flex-1 min-w-0 transition-opacity duration-300 ${
          disliked && !isThis ? 'opacity-55 group-hover:opacity-100' : ''
        }`}
      >
        <TrackTitleArtist
          track={track}
          highlight={isThis}
          size="md"
          className="flex flex-col justify-center"
        />
      </div>

      <span className="hidden sm:block text-[12px] text-white/30 tabular-nums font-medium shrink-0 w-12 text-right">
        {dur(track.duration)}
      </span>

      <button
        type="button"
        onClick={toggleDislike}
        aria-pressed={disliked}
        className={`inline-flex items-center gap-2 h-8 px-3.5 rounded-full text-[12px] font-semibold shrink-0 transition-all duration-200 cursor-pointer active:scale-[0.97] ${
          disliked
            ? 'bg-rose-400/[0.12] text-rose-300 ring-1 ring-rose-400/25 hover:bg-rose-400/20 hover:text-rose-200'
            : 'text-white/40 ring-1 ring-white/[0.08] hover:text-white/80 hover:bg-white/[0.06]'
        }`}
      >
        <ThumbsDown size={13} fill={disliked ? 'currentColor' : 'none'} />
        {disliked ? t('track.removeDislike') : t('track.dislike')}
      </button>
    </div>
  );
});
