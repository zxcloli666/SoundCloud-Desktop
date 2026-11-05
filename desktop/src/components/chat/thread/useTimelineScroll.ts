import type { Virtualizer } from '@tanstack/react-virtual';
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Row } from './rows';

const STICK_PX = 56;
const AWAY_PX = 320;
const MOVING_MS = 900;

interface Anchor {
  key: string;
  delta: number;
}

export function useTimelineScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  rows: Row[],
  ready: boolean,
  initialIndex: number,
) {
  const stuck = useRef(true);
  const placed = useRef(false);
  const anchor = useRef<Anchor | null>(null);
  const firstKey = useRef<string | null>(null);
  const [away, setAway] = useState(false);
  const [settled, setSettled] = useState(false);
  const [moving, setMoving] = useState(false);
  const movingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    stuck.current = true;
    element.scrollTop = element.scrollHeight;
    setAway(false);
  }, [scrollRef]);

  const release = useCallback(() => {
    stuck.current = false;
  }, []);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    stuck.current = distance < STICK_PX;
    setAway(distance > AWAY_PX);
    if (settled) {
      setMoving(true);
      if (movingTimer.current) clearTimeout(movingTimer.current);
      movingTimer.current = setTimeout(() => setMoving(false), MOVING_MS);
    }
    const top = virtualizer.getVirtualItems().find((item) => item.end > element.scrollTop);
    anchor.current = top ? { key: String(top.key), delta: element.scrollTop - top.start } : null;
  }, [scrollRef, virtualizer, settled]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || !ready || rows.length === 0) return;
    const previousFirst = firstKey.current;
    firstKey.current = rows[0].key;
    if (!placed.current) {
      placed.current = true;
      requestAnimationFrame(() => setSettled(true));
      if (initialIndex >= 0) {
        stuck.current = false;
        virtualizer.scrollToIndex(initialIndex, { align: 'start' });
      } else {
        toBottom();
      }
      return;
    }
    if (stuck.current) {
      element.scrollTop = element.scrollHeight;
      return;
    }
    const saved = anchor.current;
    if (previousFirst === rows[0].key || !saved) return;
    const index = rows.findIndex((row) => row.key === saved.key);
    const item = index >= 0 ? virtualizer.measurementsCache[index] : undefined;
    if (item) element.scrollTop = item.start + saved.delta;
  }, [rows, ready, initialIndex, scrollRef, virtualizer, toBottom]);

  const total = virtualizer.getTotalSize();
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && placed.current && stuck.current && total > 0) {
      element.scrollTop = element.scrollHeight;
    }
  }, [total, scrollRef]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (placed.current && stuck.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (movingTimer.current) clearTimeout(movingTimer.current);
    };
  }, [scrollRef]);

  return { away, settled, moving, onScroll, toBottom, release };
}
