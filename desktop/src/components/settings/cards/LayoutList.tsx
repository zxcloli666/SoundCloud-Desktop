import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
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
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical } from '../../../lib/icons';
import { lockX } from '../../layout/SortableStack';

export interface LayoutListItem {
  id: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  dimmed?: boolean;
  trailing?: ReactNode;
}

function LayoutRow({ item }: { item: LayoutListItem }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative flex items-center gap-3 h-12 pl-1.5 pr-2 rounded-2xl border transition-[background-color,border-color,opacity] duration-200 ${
        isDragging
          ? 'z-10 border-[var(--color-accent)] bg-white/[0.08]'
          : 'border-white/[0.05] bg-white/[0.025] hover:bg-white/[0.04]'
      }`}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        boxShadow: isDragging
          ? '0 14px 36px rgba(0,0,0,0.5), 0 0 18px var(--color-accent-glow)'
          : undefined,
      }}
    >
      <button
        type="button"
        aria-label={t('settings.layoutDrag')}
        className="w-7 h-9 shrink-0 flex items-center justify-center rounded-lg text-white/20 hover:text-white/55 cursor-grab active:cursor-grabbing transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={15} />
      </button>
      <span
        className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center transition-opacity duration-200 ${
          item.dimmed ? 'opacity-35 text-white/60' : 'text-[var(--color-accent)]'
        }`}
        style={{
          background: item.dimmed
            ? 'rgba(255,255,255,0.04)'
            : 'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.03))',
        }}
      >
        {item.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[13px] font-medium transition-colors duration-200 ${
            item.dimmed ? 'text-white/30' : 'text-white/80'
          }`}
        >
          {item.label}
        </div>
        {item.hint && <div className="truncate text-[11px] text-white/30">{item.hint}</div>}
      </div>
      {item.trailing}
    </div>
  );
}

export function LayoutList({
  items,
  onMove,
}: {
  items: LayoutListItem[];
  onMove: (from: string, to: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMove(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[lockX]}
      onDragEnd={handleEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <LayoutRow key={item.id} item={item} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export function RowIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
        active
          ? 'text-white/70 hover:text-white hover:bg-white/[0.07]'
          : 'text-white/25 hover:text-white/60 hover:bg-white/[0.05]'
      }`}
    >
      {children}
    </button>
  );
}
