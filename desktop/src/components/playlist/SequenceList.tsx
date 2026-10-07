import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Clock, ListMusic, Loader2} from '../../lib/icons';
import type {Track} from '../../stores/player';
import {VirtualList} from '../ui/VirtualList';
import {SequenceRow, SequenceRowOverlay, SortableSequenceRow} from './SequenceRow';

const PANEL = {
  background: 'rgba(255,255,255,0.02)',
  border: '0.5px solid rgba(255,255,255,0.06)',
  boxShadow: '0 24px 60px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)',
} as const;

function Header({ count, toolbar }: { count: number; toolbar?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 px-3 pt-1 pb-3">
      <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-white/55">
        <ListMusic size={12} /> {t('playlist.theSequence')}
        <span className="text-white/25 ml-1 tabular-nums">{count}</span>
      </span>
      <div className="flex items-center gap-3">
        {toolbar}
        <Clock size={12} className="text-white/25" />
      </div>
    </div>
  );
}

export const SequenceList = React.memo(function SequenceList({
  tracks,
  notice,
  toolbar,
  reorderable,
  onDragEnd,
  onRemove,
  onPlay,
  sentinelRef,
  hasNextPage,
  isFetchingNextPage,
}: {
  tracks: Track[];
  notice: React.ReactNode;
  toolbar?: React.ReactNode;
  reorderable: boolean;
  onDragEnd: (e: DragEndEvent) => void;
  onRemove?: (urn: string) => void;
  onPlay?: () => void;
  sentinelRef: React.Ref<HTMLDivElement>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const ids = useMemo(() => tracks.map((tr) => tr.urn), [tracks]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = activeId ? tracks.findIndex((tr) => tr.urn === activeId) : -1;
  const activeTrack = activeIndex >= 0 ? tracks[activeIndex] : null;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const getQueue = useCallback(() => tracksRef.current, []);

  if (tracks.length === 0 && notice) {
    return <div className="py-20">{notice}</div>;
  }

  if (tracks.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.06)',
          }}
        >
          <ListMusic size={24} className="text-white/15" />
        </div>
        <p className="text-white/30 text-sm">{t('playlist.emptyCrate')}</p>
      </div>
    );
  }

  const sentinel = hasNextPage ? (
    <div ref={sentinelRef} className="flex justify-center py-4">
      {isFetchingNextPage && <Loader2 size={20} className="animate-spin text-white/30" />}
    </div>
  ) : null;

  return (
    <div className="rounded-[2rem] p-3 md:p-4" style={PANEL}>
      <Header count={tracks.length} toolbar={toolbar} />
      {reorderable && onRemove ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={(e) => {
            setActiveId(null);
            onDragEnd(e);
          }}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <VirtualList
              items={tracks}
              rowHeight={68}
              overscan={12}
              className="space-y-0.5"
              getItemKey={(tr) => tr.urn}
              renderItem={(track, i) => (
                <SortableSequenceRow
                  track={track}
                  index={i}
                  queue={getQueue}
                  onRemove={onRemove}
                  onPlay={onPlay}
                />
              )}
            />
          </SortableContext>
          <DragOverlay>
            {activeTrack ? (
              <SequenceRowOverlay track={activeTrack} index={activeIndex} queue={getQueue} />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <VirtualList
          items={tracks}
          rowHeight={68}
          overscan={10}
          className="space-y-0.5"
          getItemKey={(tr) => tr.urn}
          renderItem={(track, i) => (
            <SequenceRow
              track={track}
              index={i}
              queue={getQueue}
              onRemove={onRemove}
              onPlay={onPlay}
            />
          )}
        />
      )}
      {sentinel}
      {notice && <div className="py-6">{notice}</div>}
    </div>
  );
});
