import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VirtualList } from '../../ui/VirtualList';
import { LOCAL_ROW_HEIGHT, LocalRowClone, LocalTrackRow, SortableLocalRow } from './LocalTrackRow';
import type { LocalRow } from './lib';

interface LocalTrackListProps {
  rows: LocalRow[];
  sortable: boolean;
  inPlaylist: boolean;
  emptyText: string;
  onPlay: (row: LocalRow) => void;
  onRemove: (row: LocalRow) => void;
  onReorder: (ids: string[]) => void;
}

export const LocalTrackList = React.memo(function LocalTrackList({
  rows,
  sortable,
  inPlaylist,
  emptyText,
  onPlay,
  onRemove,
  onReorder,
}: LocalTrackListProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const activeRow = activeId ? (rows.find((r) => r.id === activeId) ?? null) : null;

  if (rows.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-white/[0.08] bg-white/[0.015] px-5 py-12 text-center text-[13px] text-white/30">
        {emptyText}
      </div>
    );
  }

  const renderRow = (row: LocalRow, index: number) => {
    const props = { row, index, sortable, inPlaylist, onPlay, onRemove };
    return sortable ? <SortableLocalRow {...props} /> : <LocalTrackRow {...props} />;
  };

  const list = (
    <VirtualList
      items={rows}
      rowHeight={LOCAL_ROW_HEIGHT}
      overscan={8}
      getItemKey={(row) => row.id}
      renderItem={renderRow}
    />
  );

  return (
    <section className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-[rgba(255,255,255,0.015)]">
      <div className="grid h-8 grid-cols-[28px_minmax(0,1fr)_88px_64px] items-center gap-3 border-b border-white/[0.07] bg-white/[0.015] pl-2 pr-4 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-white/30 md:grid-cols-[28px_minmax(0,1fr)_auto_88px_64px]">
        <span className="text-center">№</span>
        <span>{t('offline.listTrack')}</span>
        <span className="hidden text-right md:block">{t('local.listFormat')}</span>
        <span className="text-right">{t('offline.listWeight')}</span>
        <span className="text-right">{t('offline.listTime')}</span>
      </div>
      {sortable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(String(active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={({ active, over }) => {
            setActiveId(null);
            if (!over || active.id === over.id) return;
            const from = ids.indexOf(String(active.id));
            const to = ids.indexOf(String(over.id));
            if (from < 0 || to < 0) return;
            onReorder(arrayMove(ids, from, to));
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
            {activeRow ? <LocalRowClone row={activeRow} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        list
      )}
    </section>
  );
});
