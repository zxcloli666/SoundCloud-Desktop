import React from 'react';
import {cancelPreload, preloadTrack} from '../../lib/audio';
import {art, dur, fc} from '../../lib/formatters';
import {Headphones, musicIcon14, pauseBlack11, playBlack11} from '../../lib/icons';
import {useTrackPlay} from '../../lib/useTrackPlay';
import type {Track} from '../../stores/player';
import {sameScdMeta, TrackStatusBadges} from '../music/TrackStatusBadges';
import {TrackTitleArtist} from '../music/TrackTitleArtist';

export const RelatedRow = React.memo(
  function RelatedRow({ track, queue }: { track: Track; queue: Track[] | (() => Track[]) }) {
    const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const cover = art(track.artwork_url, 't200x200');

    return (
      <div
        className={`group flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-300 ease-[var(--ease-apple)] ${
          isThis ? 'bg-accent/[0.05] ring-1 ring-accent/20' : 'hover:bg-white/[0.04]'
        }`}
        onMouseEnter={() => preloadTrack(track.urn)}
        onMouseLeave={cancelPreload}
      >
        <button
          type="button"
          className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.07] cursor-pointer"
          onClick={togglePlay}
        >
          {cover ? (
            <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
              {musicIcon14}
            </div>
          )}
          <span
            className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
              isThisPlaying
                ? 'bg-black/35 opacity-100'
                : 'opacity-0 group-hover:bg-black/35 group-hover:opacity-100'
            }`}
          >
            <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg">
              {isThisPlaying ? pauseBlack11 : playBlack11}
            </span>
          </span>
        </button>

        <TrackTitleArtist track={track} size="sm" />

        <div className="shrink-0">
          <TrackStatusBadges meta={track._scd_meta} />
        </div>

        <div className="text-right shrink-0">
          <p className="text-[10px] text-white/30 tabular-nums">{dur(track.duration)}</p>
          {track.playback_count != null && (
            <p className="text-[9px] text-white/15 mt-0.5 tabular-nums flex items-center gap-0.5 justify-end">
              <Headphones size={8} />
              {fc(track.playback_count)}
            </p>
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn &&
    prev.track.title === next.track.title &&
    prev.track.enrichment === next.track.enrichment &&
    sameScdMeta(prev.track._scd_meta, next.track._scd_meta),
);
