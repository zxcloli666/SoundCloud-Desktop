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
import { HeadCell } from '../music/columns/HeadCell';
import { useColumnVars } from '../music/columns/useColumnVars';
import { VirtualList } from '../ui/VirtualList';
import {
  OfflineRowClone,
  OfflineTrackRow,
  ROW_HEIGHT,
  SortableOfflineRow,
} from './OfflineTrackRow';
import type { OfflineEntry } from './types';

interface OfflineTrackListProps {
  entries: OfflineEntry[];
  sortable: boolean;
  likesSection: boolean;
  forgingUrns: ReadonlySet<string>;
  downloads: Record<string, number>;
  emptyText: string;
  onPlay: (entry: OfflineEntry) => void;
  onDownload: (entry: OfflineEntry) => void;
  onRefetch: (entry: OfflineEntry) => void;
  onRemove: (urn: string) => void;
  onReorder: (urns: string[]) => void;
}

function ListHead({ t }: { t: (k: string) => string }) {
  return (
    <div className="grid h-8 grid-cols-[28px_minmax(0,1fr)_var(--col-size,88px)_var(--col-time,64px)] items-center gap-3 border-b border-ink/[0.07] bg-ink/[0.015] pl-2 pr-4 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-30 md:grid-cols-[28px_minmax(0,1fr)_auto_var(--col-size,88px)_var(--col-time,64px)]">
      <span className="text-center">№</span>
      <span>{t('offline.listTrack')}</span>
      <span className="hidden text-right md:block">{t('offline.listStamp')}</span>
      <HeadCell id="size">{t('offline.listWeight')}</HeadCell>
      <HeadCell id="time">{t('offline.listTime')}</HeadCell>
    </div>
  );
}

/** Список-манифест: виртуализирован; в режиме «Свой порядок» строки
 *  перетаскиваются (dnd-kit + DragOverlay поверх виртуализации). */
export const OfflineTrackList = React.memo(function OfflineTrackList({
  entries,
  sortable,
  likesSection,
  forgingUrns,
  downloads,
  emptyText,
  onPlay,
  onDownload,
  onRefetch,
  onRemove,
  onReorder,
}: OfflineTrackListProps) {
  const { t } = useTranslation();
  const vars = useColumnVars();
  const [activeUrn, setActiveUrn] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const urns = useMemo(() => entries.map((e) => e.urn), [entries]);
  const activeEntry = activeUrn ? (entries.find((e) => e.urn === activeUrn) ?? null) : null;

  const canSort = sortable && entries.length <= 160;

  if (entries.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-ink/[0.08] bg-ink/[0.015] px-5 py-12 text-center text-[13px] text-ink-30">
        {emptyText}
      </div>
    );
  }

  const renderRow = (entry: OfflineEntry, index: number) => {
    const props = {
      entry,
      index,
      sortable: canSort,
      likesSection,
      forging: forgingUrns.has(entry.urn),
      downloadProgress: downloads[entry.urn],
      onPlay,
      onDownload,
      onRefetch,
      onRemove,
    };
    return canSort ? <SortableOfflineRow {...props} /> : <OfflineTrackRow {...props} />;
  };

  const list = (
    <VirtualList
      items={entries}
      rowHeight={ROW_HEIGHT}
      overscan={8}
      getItemKey={(entry) => entry.urn}
      renderItem={renderRow}
    />
  );

  return (
    <section
      className="overflow-hidden rounded-[18px] border border-ink/[0.07] bg-[rgb(var(--ink)/0.015)]"
      style={vars}
    >
      <ListHead t={t} />
      {canSort ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveUrn(String(active.id))}
          onDragCancel={() => setActiveUrn(null)}
          onDragEnd={({ active, over }) => {
            setActiveUrn(null);
            if (!over || active.id === over.id) return;
            const from = urns.indexOf(String(active.id));
            const to = urns.indexOf(String(over.id));
            if (from < 0 || to < 0) return;
            onReorder(arrayMove(urns, from, to));
          }}
        >
          <SortableContext items={urns} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
            {activeEntry ? <OfflineRowClone entry={activeEntry} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        list
      )}
    </section>
  );
});
