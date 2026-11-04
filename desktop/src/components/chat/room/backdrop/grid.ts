import type { KeyboardEvent } from 'react';

export const GRID_COLUMNS = 4;

const STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: GRID_COLUMNS,
  ArrowUp: -GRID_COLUMNS,
};

export function moveInGrid(event: KeyboardEvent<HTMLElement>) {
  const tiles = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-tile]'));
  const index = tiles.indexOf(document.activeElement as HTMLElement);
  let next = -1;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tiles.length - 1;
  else if (event.key in STEPS)
    next = Math.max(0, Math.min(tiles.length - 1, (index < 0 ? 0 : index) + STEPS[event.key]));
  if (next < 0) return;
  event.preventDefault();
  tiles[next]?.focus();
}
