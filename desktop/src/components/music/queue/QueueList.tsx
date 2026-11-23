import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from '../../../lib/reduced-motion';
import { usePlayerStore } from '../../../stores/player';
import { useMainScroll } from '../../ui/useMainScroll';
import { PlayedToggle } from './PlayedToggle';
import { QueueRow, QueueRowLifted } from './QueueRow';
import { AutoplayHint, QueueSection } from './QueueSection';
import { groupAfterMove, type QueueItem } from './queue-items';
import { queueKeyHandler } from './queue-keys';
import { useQueueShape } from './use-queue-shape';

const DROP = { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };

interface Props {
  playedOpen: boolean;
  onPlayedToggle: () => void;
}

export const QueueList = React.memo(function QueueList({ playedOpen, onPlayedToggle }: Props) {
  const { queue, queueIndex, ids, groups, items } = useQueueShape(playedOpen);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollElement, scrollMargin } = useMainScroll(rootRef);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const sortable = useMemo(() => ids.slice(queueIndex + 1), [ids, queueIndex]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElement,
    estimateSize: (at) => items[at].size,
    getItemKey: (at) => items[at].key,
    overscan: 8,
    scrollMargin,
  });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const player = usePlayerStore.getState();
    player.moveInQueue(from, to);
    const regroup = groupAfterMove(groups, from, to);
    if (regroup) player.setQueueOrigin(queue[from].urn, regroup === 'context' ? null : regroup);
  };

  const render = (item: QueueItem, at: number) => {
    if (item.kind === 'played') {
      return (
        <div className="flex h-full items-center">
          <PlayedToggle count={item.count} open={item.open} at={at} onToggle={onPlayedToggle} />
        </div>
      );
    }
    if (item.kind === 'section') {
      return <QueueSection group={item.group} count={item.count} autoplay={item.autoplay} />;
    }
    if (item.kind === 'hint') return <AutoplayHint />;
    return (
      <QueueRow
        track={queue[item.index]}
        id={item.key}
        index={item.index}
        at={at}
        tone={item.tone}
        playing={item.tone === 'now' && isPlaying}
      />
    );
  };

  const lifted = activeId ? queue[ids.indexOf(activeId)] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={sortable} strategy={verticalListSortingStrategy}>
        <div
          ref={rootRef}
          role="list"
          onKeyDown={queueKeyHandler(items, virtualizer, rootRef)}
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((row) => (
            <div
              key={row.key}
              role="listitem"
              className="absolute top-0 left-0 w-full"
              style={{ height: row.size, transform: `translateY(${row.start - scrollMargin}px)` }}
            >
              {render(items[row.index], row.index)}
            </div>
          ))}
        </div>
      </SortableContext>
      {createPortal(
        <DragOverlay dropAnimation={reduced ? null : DROP}>
          {lifted ? <QueueRowLifted track={lifted} /> : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
});
