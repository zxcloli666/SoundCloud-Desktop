import React from 'react';
import { cancelPreload, preloadTrack } from '../../lib/audio';
import {
  hardStopHoverPreview,
  startHoverPreview,
  stopHoverPreview,
  useIsPreviewActive,
} from '../../lib/audioPreview';
import { art, dur, fc } from '../../lib/formatters';
import { headphones11, heart11, Music, pauseWhite14, playWhite14 } from '../../lib/icons';
import { useRowPick } from '../../lib/useRowPick';
import { useTrackContextMenu } from '../../lib/useTrackContextMenu';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { AddToPlaylistButton } from '../music/AddToPlaylistButton';
import { AlbumLinkButton } from '../music/AlbumLinkButton';
import { useTrackColumns } from '../music/columns/TrackColumns';
import { LikeButton } from '../music/LikeButton';
import { PlayNextButton } from '../music/PlayNextButton';
import { SaveOfflineRowButton } from '../music/SaveOfflineButton';
import { sameScdMeta, sameVideos } from '../../lib/track-rating';
import { TrackRating } from '../music/TrackRating';
import { TrackTitleArtist } from '../music/TrackTitleArtist';
import { PreviewRing } from '../search/PreviewRing';

export const LibraryTrackRow = React.memo(
  function LibraryTrackRow({
    track,
    index,
    queue,
    onPlay,
    grip,
    previewOnHover = false,
    alwaysShowPlay = false,
  }: {
    track: Track;
    index: number;
    queue: Track[] | (() => Track[]);
    onPlay?: () => void;
    grip?: React.ReactNode;
    previewOnHover?: boolean;
    alwaysShowPlay?: boolean;
  }) {
    const { isThis, isThisPlaying, togglePlay, mark } = useTrackPlay(track, queue, onPlay);
    const onContextMenu = useTrackContextMenu(track);
    const columns = useTrackColumns();
    const pick = useRowPick(track);
    const previewing = useIsPreviewActive(track.urn);

    const cover = art(track.artwork_url, 't200x200');

    return (
      <div
        {...mark}
        onContextMenu={(event) => {
          hardStopHoverPreview();
          onContextMenu(event);
        }}
        onMouseEnter={
          previewOnHover
            ? () => {
                preloadTrack(track);
                startHoverPreview(track);
              }
            : undefined
        }
        onMouseLeave={
          previewOnHover
            ? () => {
                cancelPreload();
                stopHoverPreview();
              }
            : undefined
        }
        {...pick}
        className={`@container group flex items-center gap-4 px-4 py-3 rounded-2xl transition-colors duration-200 ${
          isThis ? 'bg-accent/[0.07] ring-1 ring-accent/20' : 'hover:bg-ink/[0.04]'
        }`}
      >
        {grip}
        <div
          className="w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer"
          onClick={() => {
            hardStopHoverPreview();
            togglePlay();
          }}
          onMouseEnter={() => preloadTrack(track)}
          onMouseLeave={cancelPreload}
        >
          {isThisPlaying ? (
            <div className="w-8 h-8 rounded-full bg-accent text-accent-contrast flex items-center justify-center">
              {pauseWhite14}
            </div>
          ) : alwaysShowPlay ? (
            <div className="flex w-8 h-8 rounded-full bg-ink/10 items-center justify-center text-ink-75 hover:bg-ink/20 transition-colors">
              {playWhite14}
            </div>
          ) : (
            <>
              <span className="text-[13px] text-ink-20 tabular-nums font-medium group-hover:hidden">
                {index + 1}
              </span>
              <div className="hidden group-hover:flex w-8 h-8 rounded-full bg-ink/10 items-center justify-center hover:bg-ink/20 hover:scale-105 transition-all">
                {playWhite14}
              </div>
            </>
          )}
        </div>

        <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 ring-1 ring-ink/[0.08]">
          {cover ? (
            <img
              data-ui="artwork"
              src={cover}
              alt=""
              className="w-full h-full object-cover"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ink/[0.05] to-transparent">
              <Music size={14} className="text-ink-20" />
            </div>
          )}
          {previewing && <PreviewRing radius={12} />}
        </div>

        <TrackTitleArtist
          track={track}
          highlight={isThis}
          size="md"
          className="flex flex-col justify-center"
        />

        <TrackRating meta={track._scd_meta} videos={track.videos} />

        {columns.plays > 0 && (
          <span
            className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-30 tabular-nums"
            style={{ width: columns.plays }}
          >
            {track.playback_count != null && (
              <>
                {headphones11}
                {fc(track.playback_count)}
              </>
            )}
          </span>
        )}

        {columns.likes > 0 && (
          <span
            className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-30 tabular-nums"
            style={{ width: columns.likes }}
          >
            {heart11}
            {fc(track.favoritings_count ?? track.likes_count)}
          </span>
        )}

        <div
          className="flex shrink-0 items-center justify-end gap-0.5"
          style={{ width: columns.actions }}
        >
          <LikeButton track={track} />
          <SaveOfflineRowButton track={track} />

          <AddToPlaylistButton
            track={track}
            size={16}
            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-ink-30 hover:text-ink-80 hover:bg-ink/[0.08] transition-all duration-200 shrink-0"
          />

          <AlbumLinkButton
            track={track}
            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-ink-30 hover:text-ink-80 hover:bg-ink/[0.08] transition-all duration-200 shrink-0"
          />

          <PlayNextButton
            track={track}
            size={16}
            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center text-ink-30 hover:text-ink-80 hover:bg-ink/[0.08] transition-all duration-200 shrink-0"
          />
        </div>

        <span className="text-[12px] text-ink-30 tabular-nums font-medium shrink-0 w-12 text-right">
          {dur(track.duration)}
        </span>
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn &&
    prev.index === next.index &&
    prev.grip === next.grip &&
    prev.track.title === next.track.title &&
    prev.track.enrichment === next.track.enrichment &&
    prev.previewOnHover === next.previewOnHover &&
    prev.alwaysShowPlay === next.alwaysShowPlay &&
    sameScdMeta(prev.track._scd_meta, next.track._scd_meta) &&
    sameVideos(prev.track.videos, next.track.videos),
);
