import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import type { ListOrder } from '../../lib/list-order';
import type { Track } from '../../stores/player';
import {
  DragGrip,
  LIFTED_ROW_STYLE,
  SortableVirtualList,
  useSortableRow,
} from '../ui/SortableVirtualList';
import { LibraryTrackRow } from './LibraryTrackRow';

type RowQueue = () => Track[];

function urnOf(track: Track) {
  return track.urn;
}

const SortableTrackRow = React.memo(function SortableTrackRow({
  track,
  index,
  queue,
  onPlay,
}: {
  track: Track;
  index: number;
  queue: RowQueue;
  onPlay?: () => void;
}) {
  const sortable = useSortableRow(track.urn);
  return (
    <div ref={sortable.ref} data-ui="track-row" style={sortable.style}>
      <LibraryTrackRow
        track={track}
        index={index}
        queue={queue}
        onPlay={onPlay}
        grip={<DragGrip handle={sortable.handle} />}
      />
    </div>
  );
});

function TrackRowOverlay({
  track,
  index,
  queue,
}: {
  track: Track;
  index: number;
  queue: RowQueue;
}) {
  return (
    <div className="rounded-2xl bg-ink/[0.06] cursor-grabbing" style={LIFTED_ROW_STYLE}>
      <LibraryTrackRow track={track} index={index} queue={queue} grip={<DragGrip />} />
    </div>
  );
}

export const OrderableTracks = React.memo(function OrderableTracks({
  tracks,
  order,
  queue,
  onPlay,
}: {
  tracks: Track[];
  order: ListOrder;
  queue: RowQueue;
  onPlay?: () => void;
}) {
  const qc = useQueryClient();

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = tracks.findIndex((track) => track.urn === active.id);
    const to = tracks.findIndex((track) => track.urn === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(tracks, from, to);
    order.move(qc, tracks[from], to === 0 ? 'top' : { after: next[to - 1].urn });
  };

  return (
    <SortableVirtualList
      items={tracks}
      getId={urnOf}
      rowHeight={68}
      overscan={12}
      className="flex flex-col gap-1"
      onDragEnd={handleDragEnd}
      renderItem={(track, i) => (
        <SortableTrackRow track={track} index={i} queue={queue} onPlay={onPlay} />
      )}
      renderOverlay={(track, i) => <TrackRowOverlay track={track} index={i} queue={queue} />}
    />
  );
});
