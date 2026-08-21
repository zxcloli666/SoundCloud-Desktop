import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React from 'react';
import { art, dur } from '../../../lib/formatters';
import { GripVertical, X } from '../../../lib/icons';
import { useArtistDisplay, useArtistLinkItems, useDisplayTitle } from '../../../lib/track-display';
import { type Track, usePlayerStore } from '../../../stores/player';
import { ArtistNameLinks } from '../ArtistNameLinks';
import { TrackStatusBadges } from '../TrackStatusBadges';
import { UploadKindDot } from '../UploadKindDot';
import { PlayingOverlay } from './PlayingOverlay';

const QueueTrackRowBody = React.memo(function QueueTrackRowBody({
  track,
  isCurrent,
  onClick,
}: {
  track: Track;
  isCurrent: boolean;
  onClick?: () => void;
}) {
  const artistDisplay = useArtistDisplay(track);
  const displayTitle = useDisplayTitle(track);
  const artistLinks = useArtistLinkItems(track);
  return (
    <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
      <p
        className={`text-[12px] truncate leading-snug ${isCurrent ? 'text-accent font-medium' : 'text-white/80'}`}
      >
        {displayTitle}
      </p>
      <p className="text-[10px] text-white/30 truncate mt-0.5 flex items-center gap-1">
        <UploadKindDot kind={artistDisplay.uploadKind} />
        <span className="truncate">
          <ArtistNameLinks
            items={artistLinks}
            linkClassName="cursor-pointer transition-colors hover:text-white/60"
          />
        </span>
      </p>
    </div>
  );
});

export const QueueRow = React.memo(function QueueRow({
  track,
  absIdx,
  position,
  isCurrent,
  isPlaying,
}: {
  track: Track;
  absIdx: number;
  /** 1-based position in the up-next list (shown until hovered → grip). */
  position: number;
  isCurrent: boolean;
  isPlaying: boolean;
}) {
  const artwork = art(track.artwork_url, 't200x200');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(absIdx),
  });

  const handleClick = () => {
    const s = usePlayerStore.getState();
    if (absIdx === s.queueIndex && s.isPlaying) s.pause();
    else if (absIdx === s.queueIndex) s.resume();
    else s.playFromQueue(absIdx);
  };

  const handleRemove = () => usePlayerStore.getState().removeFromQueue(absIdx);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2.5 pl-2 pr-2.5 py-2 rounded-xl group transition-colors duration-150 select-none ${
        isDragging
          ? 'opacity-30'
          : isCurrent
            ? 'bg-white/[0.08] ring-1 ring-white/[0.08]'
            : 'hover:bg-white/[0.05]'
      }`}
    >
      <div
        className="w-5 shrink-0 flex items-center justify-center text-white/20 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <span className="text-[11px] tabular-nums group-hover:hidden">{position}</span>
        <GripVertical size={14} className="hidden group-hover:block group-hover:text-white/45" />
      </div>

      <div
        className="w-9 h-9 rounded-lg overflow-hidden shrink-0 relative bg-white/[0.04] cursor-pointer"
        onClick={handleClick}
      >
        {artwork ? (
          <img
            src={artwork}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full" />
        )}
        {isCurrent && <PlayingOverlay isPlaying={isPlaying} />}
      </div>

      <QueueTrackRowBody track={track} isCurrent={isCurrent} onClick={handleClick} />

      <div className="shrink-0">
        <TrackStatusBadges meta={track._scd_meta} />
      </div>

      <span className="text-[10px] text-white/20 tabular-nums shrink-0">{dur(track.duration)}</span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleRemove();
        }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-white/0 group-hover:text-white/25 hover:!text-white/60 hover:!bg-white/[0.06] transition-all duration-150 cursor-pointer shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
});

/** Floating clone rendered inside dnd-kit's <DragOverlay> while dragging. */
export const QueueRowClone = React.memo(function QueueRowClone({ track }: { track: Track }) {
  const artwork = art(track.artwork_url, 't200x200');
  return (
    <div className="flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-xl bg-[rgba(28,28,34,0.96)] ring-1 ring-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl cursor-grabbing">
      <GripVertical size={14} className="text-white/45 shrink-0" />
      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-white/[0.04]">
        {artwork && (
          <img
            src={artwork}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
      <QueueTrackRowBody track={track} isCurrent={false} />
    </div>
  );
});
