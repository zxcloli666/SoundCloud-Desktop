import { useDroppable } from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { type MouseEventHandler, type ReactNode } from 'react';
import type { PlayerButtonId, Surface, Zone as ZoneId } from '../../../lib/player-zones';
import { usePlacement } from '../../../lib/use-layout';
import { zoneKey } from '../../../lib/use-zone-drag';
import { BUTTONS, type PlayerContext } from './buttons';
import { NextBtn, PlayPauseBtn, PrevBtn } from './transport';
import { useBoard } from './zone-board';

export type { PlayerContext } from './buttons';

const POPOVER_IDS: readonly PlayerButtonId[] = ['mic', 'sleep', 'tuning', 'eq', 'effects'];

function ZoneItem({ id, motion, children }: { id: string; motion: boolean; children: ReactNode }) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id,
    transition: motion ? undefined : null,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      className="zone-item"
      data-lifted={isDragging ? 'true' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children}
    </div>
  );
}

export function Zone({
  zone,
  ctx,
  className,
  onContextMenu,
}: {
  zone: ZoneId;
  ctx: PlayerContext;
  className: string;
  onContextMenu?: MouseEventHandler;
}) {
  const board = useBoard();
  const ids = board.ids[zone];
  const { setNodeRef } = useDroppable({ id: zoneKey(zone) });
  if (ids.length === 0 && !board.dragging) return null;
  const drop = board.dragging ? (board.over === zone ? 'over' : 'open') : undefined;
  return (
    <div
      ref={setNodeRef}
      data-ui="player-zone"
      data-zone={zone}
      data-drop={drop}
      onContextMenu={onContextMenu}
      className={className}
    >
      <SortableContext id={zone} items={ids} strategy={horizontalListSortingStrategy}>
        {ids.map((id) => (
          <ZoneItem key={id} id={id} motion={board.motion}>
            {BUTTONS[id as PlayerButtonId](ctx)}
          </ZoneItem>
        ))}
      </SortableContext>
      {ids.length === 0 && <span aria-hidden className="zone-slot" />}
    </div>
  );
}

export const TransportButtons = React.memo(({ ctx }: { ctx: PlayerContext }) => (
  <div
    className="grid max-w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-0.5"
    data-ui="player-transport"
  >
    <div className="flex min-w-0 items-center justify-end gap-[inherit]">
      <Zone zone="before" ctx={ctx} className="zone-near justify-end" />
      <PrevBtn />
    </div>
    <PlayPauseBtn />
    <div className="flex min-w-0 items-center justify-start gap-[inherit]">
      <NextBtn />
      <Zone zone="after" ctx={ctx} className="zone-near" />
    </div>
  </div>
));

export const HiddenPopovers = React.memo(
  ({ surface, ctx }: { surface: Surface; ctx: PlayerContext }) => {
    const layout = usePlacement(surface);
    const hidden = POPOVER_IDS.filter((id) => layout.some((e) => e.id === id && e.hidden));
    if (hidden.length === 0) return null;
    return (
      <div aria-hidden className="npb-ghosts" data-ui="player-ghosts">
        {hidden.map((id) => (
          <React.Fragment key={id}>{BUTTONS[id](ctx)}</React.Fragment>
        ))}
      </div>
    );
  },
);
