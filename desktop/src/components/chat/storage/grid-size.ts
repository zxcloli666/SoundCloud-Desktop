import { type KeyboardEvent, type RefObject, useEffect, useState } from 'react';

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

function tileStep(key: string, columns: number): number | null {
  if (key === 'ArrowRight') return 1;
  if (key === 'ArrowLeft') return -1;
  if (key === 'ArrowDown') return columns;
  if (key === 'ArrowUp') return -columns;
  return null;
}

export function moveTileFocus(
  event: KeyboardEvent<HTMLElement>,
  node: HTMLElement | null,
  tile: number,
  count: number,
): number | null {
  const target = event.target as HTMLElement;
  if (!node || target.dataset.tile === undefined) return null;
  const step = tileStep(event.key, columnsIn(node, tile));
  if (step === null) return null;
  event.preventDefault();
  event.stopPropagation();
  const next = Math.min(count - 1, Math.max(0, Number(target.dataset.tile) + step));
  const nextTile = node.querySelector<HTMLElement>(`[data-tile="${next}"]`);
  if (!nextTile) return null;
  nextTile.focus({ preventScroll: true });
  nextTile.scrollIntoView({ block: 'nearest' });
  return next;
}
