import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical } from '../../lib/icons';
import { VirtualList } from './VirtualList';

export const LIFTED_ROW_STYLE: React.CSSProperties = {
  transform: 'rotate(1.5deg)',
  boxShadow: '0 24px 60px rgb(var(--shade) / calc(0.55 * var(--shade-alpha))), inset 0 0 0 0.5px rgba(255,255,255,0.12)',
};

function useReorderAccessibility(ids: string[]) {
  const { t } = useTranslation();
  return useMemo(() => {
    const position = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1;
    const announcements: Announcements = {
      onDragStart: ({ active }) => t('reorder.pickedUp', { position: position(active.id) }),
      onDragOver: ({ over }) =>
        over ? t('reorder.over', { position: position(over.id) }) : undefined,
      onDragEnd: ({ over }) =>
        over ? t('reorder.dropped', { position: position(over.id) }) : t('reorder.cancelled'),
      onDragCancel: () => t('reorder.cancelled'),
    };
    return { announcements, screenReaderInstructions: { draggable: t('reorder.instructions') } };
  }, [ids, t]);
}

export function SortableVirtualList<T>({
  items,
  getId,
  rowHeight,
  overscan,
  className,
  onDragEnd,
  renderItem,
  renderOverlay,
}: {
  items: T[];
  getId: (item: T) => string;
  rowHeight: number;
  overscan: number;
  className?: string;
  onDragEnd: (event: DragEndEvent) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  renderOverlay: (item: T, index: number) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => items.map(getId), [items, getId]);
  const accessibility = useReorderAccessibility(ids);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIndex = activeId ? ids.indexOf(activeId) : -1;

  return (
    <DndContext
      sensors={sensors}
      accessibility={accessibility}
      collisionDetection={closestCenter}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragEnd={(event) => {
        setActiveId(null);
        onDragEnd(event);
      }}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <VirtualList
          items={items}
          rowHeight={rowHeight}
          overscan={overscan}
          className={className}
          getItemKey={getId}
          renderItem={renderItem}
        />
      </SortableContext>
      <DragOverlay>
        {activeIndex >= 0 ? renderOverlay(items[activeIndex], activeIndex) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return {
    ref: setNodeRef,
    style: {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0 : 1,
    },
    handle: { ...attributes, ...listeners },
  };
}

export function DragGrip({ handle }: { handle?: ReturnType<typeof useSortableRow>['handle'] }) {
  const { t } = useTranslation();
  const tone = handle
    ? 'cursor-grab active:cursor-grabbing text-ink-15 hover:text-ink-40 transition-colors'
    : 'text-ink-40';
  return (
    <div
      className={`w-5 flex items-center justify-center shrink-0 -ml-1 ${tone}`}
      aria-label={handle ? t('reorder.grip') : undefined}
      {...handle}
    >
      <GripVertical size={14} />
    </div>
  );
}

export function GripSpace() {
  return <div className="w-5 shrink-0 -ml-1" aria-hidden />;
}
