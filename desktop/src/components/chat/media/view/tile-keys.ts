import type { KeyboardEvent } from 'react';

export type OpenAt = (index: number, opener: HTMLElement) => void;

export function tileKeys(
  event: KeyboardEvent<HTMLElement>,
  activate: (opener: HTMLElement) => void,
) {
  if (event.key !== ' ' || event.repeat) return;
  event.preventDefault();
  event.stopPropagation();
  activate(event.currentTarget);
}
