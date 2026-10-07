import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

export const lockX: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 60);
}

export function SortableStack({
  ids,
  onMove,
  children,
}: {
  ids: string[];
  onMove: (from: string, to: string) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleEnd = ({ active, over }: DragEndEvent) => {
    swallowNextClick();
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[lockX]}
      onDragEnd={handleEnd}
      onDragCancel={swallowNextClick}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableSlot({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      onDragStart={(event) => event.preventDefault()}
      className={`relative rounded-xl ${isDragging ? 'z-10 cursor-grabbing' : ''}`}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        background: isDragging ? 'rgba(255,255,255,0.06)' : undefined,
        boxShadow: isDragging
          ? '0 10px 28px rgba(0,0,0,0.45), inset 0 0.5px 0 rgba(255,255,255,0.12)'
          : undefined,
      }}
    >
      {children}
    </div>
  );
}
