import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  createContext,
  type PointerEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { usePerfMode } from '../../../lib/perf';
import type { Surface, Zone, ZoneIds } from '../../../lib/player-zones';
import { useReducedMotion } from '../../../lib/reduced-motion';
import { usePlacement } from '../../../lib/use-layout';
import { useZoneDrag } from '../../../lib/use-zone-drag';
import { itemMeta } from '../../settings/cards/layout-items';
import { swallowNextClick } from '../SortableStack';

const NO_DRAG =
  'input, textarea, [role="slider"], [data-ui="volume"], .npb-vol-pop, .npb-vol-slider';
const MEASURE = { droppable: { strategy: MeasuringStrategy.Always } };
const DROP = { duration: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };

class PlayerPointer extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent, currentTarget }: PointerEvent) => {
        if (!nativeEvent.isPrimary || nativeEvent.button !== 0) return false;
        const target = nativeEvent.target as Element;
        return currentTarget.contains(target) && !target.closest(NO_DRAG);
      },
    },
  ];
}

interface Board {
  surface: Surface;
  ids: ZoneIds;
  dragging: boolean;
  over: Zone | null;
  motion: boolean;
}

const BoardContext = createContext<Board | null>(null);

export function useBoard(): Board {
  const board = useContext(BoardContext);
  if (!board) throw new Error('player zone outside ZoneBoard');
  return board;
}

function ZoneChip({ id }: { id: string }) {
  return (
    <div data-ui="player-zone-chip" className="zone-chip">
      {itemMeta('player', id).icon}
    </div>
  );
}

function useDragCursor(dragging: boolean) {
  useEffect(() => {
    if (!dragging) return;
    document.documentElement.setAttribute('data-zone-drag', '');
    return () => document.documentElement.removeAttribute('data-zone-drag');
  }, [dragging]);
}

export function ZoneBoard({ surface, children }: { surface: Surface; children: ReactNode }) {
  const entries = usePlacement(surface);
  const drag = useZoneDrag(surface, entries, 'x', false);
  const sensors = useSensors(useSensor(PlayerPointer, { activationConstraint: { distance: 6 } }));
  const perf = usePerfMode();
  const reduced = useReducedMotion();
  const motion = perf.mode !== 'light' && !reduced;
  const dragging = drag.active != null;
  useDragCursor(dragging);

  const board = useMemo(
    () => ({ surface, ids: drag.ids, dragging, over: drag.over, motion }),
    [surface, drag.ids, dragging, drag.over, motion],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={drag.collide}
      measuring={MEASURE}
      autoScroll={false}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragEnd={(event) => {
        swallowNextClick();
        drag.onDragEnd(event);
      }}
      onDragCancel={() => {
        swallowNextClick();
        drag.onDragCancel();
      }}
    >
      <BoardContext.Provider value={board}>{children}</BoardContext.Provider>
      {createPortal(
        <DragOverlay dropAnimation={motion ? DROP : null}>
          {drag.active ? <ZoneChip id={drag.active} /> : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
