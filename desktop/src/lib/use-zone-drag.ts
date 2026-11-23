import {
  type Active,
  type CollisionDetection,
  closestCenter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  getFirstCollision,
  type Over,
  pointerWithin,
  rectIntersection,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settings';
import {
  type Placed,
  placeButton,
  type Surface,
  ZONES,
  type Zone,
  type ZoneIds,
  zoneIds,
} from './player-zones';

const ZONE_KEY = 'zone:';

export function zoneKey(zone: Zone): string {
  return `${ZONE_KEY}${zone}`;
}

function keyZone(id: UniqueIdentifier): Zone | null {
  const text = String(id);
  return text.startsWith(ZONE_KEY) ? (text.slice(ZONE_KEY.length) as Zone) : null;
}

function holder(ids: ZoneIds, id: UniqueIdentifier): Zone | null {
  return keyZone(id) ?? ZONES.find((zone) => ids[zone].includes(String(id))) ?? null;
}

function pastOver(active: Active, over: Over, axis: 'x' | 'y'): boolean {
  const rect = active.rect.current.translated;
  if (!rect) return false;
  return axis === 'x'
    ? rect.left > over.rect.left + over.rect.width
    : rect.top > over.rect.top + over.rect.height;
}

function sameOrder(a: ZoneIds, b: ZoneIds): boolean {
  return ZONES.every((zone) => a[zone].join() === b[zone].join());
}

export interface ZoneDrag {
  ids: ZoneIds;
  active: string | null;
  over: Zone | null;
  collide: CollisionDetection;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
}

export function useZoneDrag(
  surface: Surface,
  entries: Placed[],
  axis: 'x' | 'y',
  withHidden: boolean,
): ZoneDrag {
  const setLayout = useSettingsStore((s) => s.setLayout);
  const settled = useMemo(() => zoneIds(entries, withHidden), [entries, withHidden]);
  const [draft, setDraft] = useState<ZoneIds | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [over, setOver] = useState<Zone | null>(null);
  const ids = draft ?? settled;
  const live = useRef(ids);
  live.current = ids;
  const lastOver = useRef<UniqueIdentifier | null>(null);
  const jumped = useRef(false);

  useEffect(() => {
    if (!draft) return;
    const frame = requestAnimationFrame(() => {
      jumped.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [draft]);

  const finish = () => {
    setDraft(null);
    setActive(null);
    setOver(null);
    lastOver.current = null;
  };

  const collide: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    const hits = pointer.length > 0 ? pointer : rectIntersection(args);
    let target = getFirstCollision(hits, 'id');
    if (target != null) {
      const zone = keyZone(target);
      const inside = zone ? live.current[zone] : [];
      if (inside.length > 0) {
        const near = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((c) =>
            inside.includes(String(c.id)),
          ),
        });
        target = near[0]?.id ?? target;
      }
      lastOver.current = target;
      return [{ id: target }];
    }
    if (jumped.current) lastOver.current = args.active.id;
    return lastOver.current != null ? [{ id: lastOver.current }] : [];
  };

  const onDragStart = ({ active: lifted }: DragStartEvent) => {
    setActive(String(lifted.id));
    setDraft(settled);
    setOver(holder(settled, lifted.id));
  };

  const onDragOver = ({ active: lifted, over: target }: DragOverEvent) => {
    if (!target) return;
    const current = live.current;
    const from = holder(current, lifted.id);
    const to = holder(current, target.id);
    if (!from || !to) return;
    setOver(to);
    if (from === to) return;
    const list = current[to];
    const at = keyZone(target.id)
      ? list.length
      : list.indexOf(String(target.id)) + (pastOver(lifted, target, axis) ? 1 : 0);
    jumped.current = true;
    setDraft({
      ...current,
      [from]: current[from].filter((id) => id !== lifted.id),
      [to]: [...list.slice(0, at), String(lifted.id), ...list.slice(at)],
    });
  };

  const onDragEnd = ({ active: lifted, over: target }: DragEndEvent) => {
    const current = live.current;
    const zone = holder(current, lifted.id);
    if (!zone || !target) {
      finish();
      return;
    }
    const id = String(lifted.id);
    const list = current[zone];
    const from = list.indexOf(id);
    const to =
      holder(current, target.id) === zone && !keyZone(target.id)
        ? list.indexOf(String(target.id))
        : from;
    const final = to >= 0 && to !== from ? arrayMove(list, from, to) : list;
    const done = { ...current, [zone]: final };
    if (!sameOrder(done, settled)) {
      const next = final[final.indexOf(id) + 1] ?? null;
      setLayout(surface, placeButton(entries, surface, id, zone, next));
    }
    finish();
  };

  return { ids, active, over, collide, onDragStart, onDragOver, onDragEnd, onDragCancel: finish };
}
