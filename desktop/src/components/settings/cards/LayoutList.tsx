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
import type { HTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical } from '../../../lib/icons';
import { lockX } from '../../layout/SortableStack';

export interface LayoutListItem {
  id: string;
  icon: ReactNode;
  label: ReactNode;
  hint?: string;
  dimmed?: boolean;
  fixed?: boolean;
  trailing?: ReactNode;
}

const LIFTED_SHADOW = '0 12px 30px rgb(var(--shade) / calc(0.4 * var(--shade-alpha)))';

function RowFace({ item }: { item: LayoutListItem }) {
  return (
    <>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] transition-colors duration-150 [&>svg]:h-[15px] [&>svg]:w-[15px] ${
          item.dimmed ? 'bg-ink/[0.04] text-ink-30' : 'bg-accent/[0.12] text-[var(--color-accent)]'
        }`}
      >
        {item.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[13px] font-medium transition-colors duration-150 ${
            item.dimmed ? 'text-ink-35' : 'text-ink-90'
          }`}
        >
          {item.label}
        </div>
        {item.hint && <div className="truncate text-[11.5px] text-ink-40">{item.hint}</div>}
      </div>
      {item.trailing}
    </>
  );
}

function Grip(props: HTMLAttributes<HTMLButtonElement>) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={t('settings.layoutDrag')}
      className="flex h-9 w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-30 transition-colors hover:text-ink-70 active:cursor-grabbing"
      {...props}
    >
      <GripVertical size={15} />
    </button>
  );
}

export function LayoutRow({ item, ghost = false }: { item: LayoutListItem; ghost?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: item.fixed,
  });
  const lifted = isDragging && !ghost;

  return (
    <div
      ref={setNodeRef}
      className={`relative flex h-11 items-center gap-2.5 rounded-[10px] border pr-1.5 pl-1 transition-[background-color,border-color,opacity] duration-150 ${
        lifted
          ? 'z-10 border-accent bg-[rgb(var(--surface))]'
          : isDragging
            ? 'border-dashed border-ink/20 bg-transparent opacity-50'
            : 'border-transparent bg-[var(--set-well)] hover:bg-[var(--set-well-hi)]'
      }`}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        boxShadow: lifted ? LIFTED_SHADOW : undefined,
      }}
    >
      {item.fixed ? <span className="w-6 shrink-0" /> : <Grip {...attributes} {...listeners} />}
      <RowFace item={item} />
    </div>
  );
}

export function LiftedRow({ item }: { item: LayoutListItem }) {
  return (
    <div
      className="flex h-11 cursor-grabbing items-center gap-2.5 rounded-[10px] border border-accent bg-[rgb(var(--surface))] pr-1.5 pl-1"
      style={{ boxShadow: LIFTED_SHADOW }}
    >
      <Grip tabIndex={-1} />
      <RowFace item={item} />
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
        <div className="flex flex-col gap-1">
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
      className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[9px] transition-colors duration-150 hover:bg-ink/[0.07] ${
        active ? 'text-ink-70 hover:text-ink' : 'text-ink-30 hover:text-ink-70'
      }`}
    >
      {children}
    </button>
  );
}
