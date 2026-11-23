import React from 'react';
import { cancelPreload, preloadTrack } from '../../lib/audio';
import { art, dur, fc } from '../../lib/formatters';
import { Headphones, musicIcon14, Pause, Play } from '../../lib/icons';
import { useRowPick } from '../../lib/useRowPick';
import { useTrackContextMenu } from '../../lib/useTrackContextMenu';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { LikeButton } from '../music/LikeButton';
import { PlayNextButton } from '../music/PlayNextButton';
import { sameScdMeta, sameVideos, TrackStatusBadges } from '../music/TrackStatusBadges';
import { TrackTitleArtist } from '../music/TrackTitleArtist';

export const RelatedRow = React.memo(
  function RelatedRow({ track, queue }: { track: Track; queue: Track[] | (() => Track[]) }) {
    const { isThis, isThisPlaying, togglePlay, mark } = useTrackPlay(track, queue);
    const onContextMenu = useTrackContextMenu(track);
    const pick = useRowPick(track);
    const cover = art(track.artwork_url, 't200x200');

    return (
      <div {...mark}
        className={`group flex items-center gap-3 p-2.5 rounded-2xl transition-all duration-300 ease-[var(--ease-apple)] ${
          isThis ? 'bg-accent/[0.05] ring-1 ring-accent/20' : 'hover:bg-ink/[0.04]'
        }`}
        onMouseEnter={() => preloadTrack(track)}
        onMouseLeave={cancelPreload}
        onContextMenu={onContextMenu}
        {...pick}
      >
        <button
          type="button"
          className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-ink/[0.07] cursor-pointer"
          onClick={togglePlay}
        >
          {cover ? (
            <img
              data-ui="artwork"
              src={cover}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-ink/[0.03]">
              {musicIcon14}
            </div>
          )}
          <span
            data-scheme="dark"
            className={`absolute inset-0 flex items-center justify-center transition-[opacity,background-color] duration-200 ${
              isThisPlaying
                ? 'bg-black/35 opacity-100'
                : 'opacity-0 group-hover:bg-black/35 group-hover:opacity-100'
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-(--disc-line) bg-(--disc) text-(--disc-ink)">
              {isThisPlaying ? (
                <Pause size={11} fill="currentColor" strokeWidth={0} />
              ) : (
                <Play size={11} fill="currentColor" strokeWidth={0} className="ml-px" />
              )}
            </span>
          </span>
        </button>

        <TrackTitleArtist track={track} size="sm" />

        <div className="shrink-0">
          <TrackStatusBadges meta={track._scd_meta} videos={track.videos} />
        </div>

        <LikeButton track={track} />

        <PlayNextButton
          track={track}
          size={13}
          className="cursor-pointer w-7 h-7 rounded-lg flex items-center justify-center text-ink-30 hover:text-ink-80 hover:bg-ink/[0.06] opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
        />

        <div className="text-right shrink-0">
          <p className="text-[10px] text-ink-30 tabular-nums">{dur(track.duration)}</p>
          {track.playback_count != null && (
            <p className="mt-0.5 flex items-center justify-end gap-0.5 text-[9px] tabular-nums text-ink-30">
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
    sameScdMeta(prev.track._scd_meta, next.track._scd_meta) &&
    sameVideos(prev.track.videos, next.track.videos),
);
