import { type RefObject, useEffect, useState } from 'react';

export const TILE_MIN = 132;
export const TILE_GAP = 10;
const SETTLE_MS = 140;

export function useTileSize(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let timer = 0;
    const update = () => setWidth(node.clientWidth);
    const settle = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, SETTLE_MS);
    };
    update();
    const observer = new ResizeObserver(settle);
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [ref]);

  const safe = Math.max(width, TILE_MIN);
  const columns = Math.max(1, Math.floor((safe + TILE_GAP) / (TILE_MIN + TILE_GAP)));
  return Math.floor((safe - TILE_GAP * (columns - 1)) / columns);
}

export function columnsIn(node: HTMLElement, tile: number): number {
  return Math.max(1, Math.round((node.clientWidth + TILE_GAP) / (tile + TILE_GAP)));
}
