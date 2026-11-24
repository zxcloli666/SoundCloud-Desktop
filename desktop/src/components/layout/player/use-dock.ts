import { type RefObject, useLayoutEffect, useMemo, useState } from 'react';
import { fitsOneRow } from '../../../lib/player-row';
import { zoneIds } from '../../../lib/player-zones';
import { usePlacement } from '../../../lib/use-layout';

export function useStackedRow(dock: RefObject<HTMLDivElement | null>): boolean {
  const placement = usePlacement('player');
  const ids = useMemo(() => zoneIds(placement), [placement]);
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    const el = dock.current;
    if (!el) return;
    const measure = () => setStacked(!fitsOneRow(ids, el.offsetWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [dock, ids]);
  return stacked;
}

export function useDockHeight(dock: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = dock.current;
    const bar = el?.parentElement;
    if (!el || !bar) return;
    const root = document.documentElement.style;
    const measure = () => root.setProperty('--dock-height', `${bar.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.removeProperty('--dock-height');
    };
  }, [dock]);
}
