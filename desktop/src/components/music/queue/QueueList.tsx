import {closestCenter, DndContext, DragOverlay, PointerSensor, useSensor, useSensors,} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy} from '@dnd-kit/sortable';
import React, {useState} from 'react';
import {usePlayerStore} from '../../../stores/player';
import {QueueRow, QueueRowClone} from './QueueRow';

// Cap rendered up-next rows; dnd-kit measures every mounted sortable, so an
// unbounded queue would mount thousands of nodes.
const QUEUE_RENDER_CAP = 100;

export const QueueList = React.memo(
  ({
    startIndex,
    queueIndex,
  }: {
    startIndex: number;
    queueIndex: number;
  }) => {
    const queue = usePlayerStore((s) => s.queue);
    const [activeId, setActiveId] = useState<number | null>(null);
    const items = queue.slice(startIndex, startIndex + QUEUE_RENDER_CAP);
    const itemIds = items.map((_, localIdx) => String(startIndex + localIdx));
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const activeTrack = activeId != null ? queue[activeId] : null;

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(Number(active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={({ active, over }) => {
          setActiveId(null);
          if (!over || active.id === over.id) return;
          usePlayerStore.getState().moveInQueue(Number(active.id), Number(over.id));
        }}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-0.5">
            {items.map((track, localIdx) => {
              const absIdx = startIndex + localIdx;
              return (
                <QueueRow
                  key={`${track.urn}-${absIdx}`}
                  track={track}
                  absIdx={absIdx}
                  position={absIdx - queueIndex}
                />
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.16,1,0.3,1)' }}>
          {activeTrack ? <QueueRowClone track={activeTrack} /> : null}
        </DragOverlay>
      </DndContext>
    );
  },
);
