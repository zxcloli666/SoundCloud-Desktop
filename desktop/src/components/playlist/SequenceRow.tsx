import React from 'react';
import { useTranslation } from 'react-i18next';
import { cancelPreload, preloadTrack } from '../../lib/audio';
import { art, dur, fc } from '../../lib/formatters';
import {
  headphones9,
  heart9,
  musicIcon12,
  pauseWhite12,
  playWhite12,
  Trash2,
} from '../../lib/icons';
import { useRowPick } from '../../lib/useRowPick';
import { useTrackContextMenu } from '../../lib/useTrackContextMenu';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { useTrackColumns } from '../music/columns/TrackColumns';
import { LikeButton } from '../music/LikeButton';
import { PlayNextButton } from '../music/PlayNextButton';
import { SaveOfflineRowButton } from '../music/SaveOfflineButton';
import { sameScdMeta, sameVideos, TrackStatusBadges } from '../music/TrackStatusBadges';
import { TrackTitleArtist } from '../music/TrackTitleArtist';
import { genreColor } from '../search/utils';
import { DragGrip, LIFTED_ROW_STYLE, useSortableRow } from '../ui/SortableVirtualList';

function RowBody({
  track,
  index,
  isThis,
  isThisPlaying,
  togglePlay,
}: {
  track: Track;
  index: number;
  isThis: boolean;
  isThisPlaying: boolean;
  togglePlay: () => void;
}) {
  const columns = useTrackColumns();
  const cover = art(track.artwork_url, 't200x200');
  const hue = track.genre ? genreColor(track.genre) : null;

  return (
    <>
      {hue && (
        <span
          className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full transition-opacity duration-300"
          style={{
            background: hue,
            opacity: isThis ? 1 : 0.4,
          }}
        />
      )}
      <div
        className="w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer"
        onClick={togglePlay}
        onMouseEnter={() => preloadTrack(track)}
        onMouseLeave={cancelPreload}
      >
        {isThisPlaying ? (
          <div className="w-7 h-7 rounded-full bg-accent text-accent-contrast flex items-center justify-center">
            {pauseWhite12}
          </div>
        ) : (
          <>
            <span className="text-[12px] text-ink-25 tabular-nums font-medium group-hover:hidden">
              {index + 1}
            </span>
            <div className="hidden group-hover:flex w-7 h-7 rounded-full bg-ink/10 items-center justify-center">
              {playWhite12}
            </div>
          </>
        )}
      </div>

      <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-ink/[0.06]">
        {cover ? (
          <img
            data-ui="artwork"
            src={cover}
            alt=""
            className="w-full h-full object-cover"
            decoding="async"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-ink/[0.03]">
            {musicIcon12}
          </div>
        )}
      </div>

      <TrackTitleArtist track={track} highlight={isThis} size="sm" />

      {columns.badges && (
        <div className="flex shrink-0">
          <TrackStatusBadges meta={track._scd_meta} videos={track.videos} />
        </div>
      )}

      {columns.plays > 0 && (
        <span
          className="flex shrink-0 items-center gap-0.5 text-[10px] text-ink-20 tabular-nums"
          style={{ width: columns.plays }}
        >
          {track.playback_count != null && (
            <>
              {headphones9}
              {fc(track.playback_count)}
            </>
          )}
        </span>
      )}

      {columns.likes > 0 && (
        <span
          className="flex shrink-0 items-center gap-0.5 text-[10px] text-ink-20 tabular-nums"
          style={{ width: columns.likes }}
        >
          {(track.favoritings_count ?? track.likes_count) != null && (
            <>
              {heart9}
              {fc(track.favoritings_count ?? track.likes_count)}
            </>
          )}
        </span>
      )}

      <div
        className="flex shrink-0 items-center justify-end gap-0.5"
        style={{ width: columns.actions }}
      >
        <LikeButton track={track} />
        <SaveOfflineRowButton track={track} />
        <PlayNextButton
          track={track}
          className="cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center text-ink-20 hover:text-ink-60 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
        />
      </div>

      <span className="text-[11px] text-ink-25 tabular-nums font-medium shrink-0 w-10 text-right">
        {dur(track.duration)}
      </span>
    </>
  );
}

const ROW_BASE =
  '@container group relative flex items-center gap-3.5 pl-4 pr-4 py-3 rounded-xl transition-colors duration-200 ease-[var(--ease-apple)] select-none';

function activeCls(isThis: boolean) {
  return isThis ? 'bg-accent/[0.06] ring-1 ring-accent/20' : 'hover:bg-ink/[0.03]';
}

type RowQueue = Track[] | (() => Track[]);

function RemoveButton({ urn, onRemove }: { urn: string; onRemove: (urn: string) => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onRemove(urn)}
      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-ink-20 hover:text-bad hover:bg-bad/10 transition-all duration-200 shrink-0"
      title={t('playlist.removeTrack')}
    >
      <Trash2 size={13} />
    </button>
  );
}

export const SortableSequenceRow = React.memo(
  function SortableSequenceRow({
    track,
    index,
    queue,
    onRemove,
    onPlay,
  }: {
    track: Track;
    index: number;
    queue: RowQueue;
    onRemove: (urn: string) => void;
    onPlay?: () => void;
  }) {
    const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue, onPlay);
    const onContextMenu = useTrackContextMenu(track);
    const pick = useRowPick(track);
    const sortable = useSortableRow(track.urn);

    return (
      <div
        ref={sortable.ref}
        onContextMenu={onContextMenu}
        {...pick}
        style={sortable.style}
        className={`${ROW_BASE} ${activeCls(isThis)}`}
      >
        <DragGrip handle={sortable.handle} />

        <RowBody
          track={track}
          index={index}
          isThis={isThis}
          isThisPlaying={isThisPlaying}
          togglePlay={togglePlay}
        />

        <RemoveButton urn={track.urn} onRemove={onRemove} />
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn &&
    prev.index === next.index &&
    prev.track.user_favorite === next.track.user_favorite &&
    prev.track.title === next.track.title &&
    prev.track.enrichment === next.track.enrichment &&
    sameScdMeta(prev.track._scd_meta, next.track._scd_meta) &&
    sameVideos(prev.track.videos, next.track.videos),
);

export function SequenceRowOverlay({
  track,
  index,
  queue,
}: {
  track: Track;
  index: number;
  queue: RowQueue;
}) {
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  return (
    <div
      className={`${ROW_BASE} ${activeCls(isThis)} bg-ink/[0.06] cursor-grabbing`}
      style={LIFTED_ROW_STYLE}
    >
      <DragGrip />
      <RowBody
        track={track}
        index={index}
        isThis={isThis}
        isThisPlaying={isThisPlaying}
        togglePlay={togglePlay}
      />
    </div>
  );
}

export const SequenceRow = React.memo(
  function SequenceRow({
    track,
    index,
    queue,
    onRemove,
    onPlay,
  }: {
    track: Track;
    index: number;
    queue: RowQueue;
    onRemove?: (urn: string) => void;
    onPlay?: () => void;
  }) {
    const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue, onPlay);
    const onContextMenu = useTrackContextMenu(track);
    const pick = useRowPick(track);
    return (
      <div className={`${ROW_BASE} ${activeCls(isThis)}`} onContextMenu={onContextMenu} {...pick}>
        <RowBody
          track={track}
          index={index}
          isThis={isThis}
          isThisPlaying={isThisPlaying}
          togglePlay={togglePlay}
        />
        {onRemove && <RemoveButton urn={track.urn} onRemove={onRemove} />}
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn &&
    prev.index === next.index &&
    prev.track.user_favorite === next.track.user_favorite &&
    prev.track.title === next.track.title &&
    prev.track.enrichment === next.track.enrichment &&
    sameScdMeta(prev.track._scd_meta, next.track._scd_meta) &&
    sameVideos(prev.track.videos, next.track.videos),
);
