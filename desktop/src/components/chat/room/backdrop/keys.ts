import type { KeyboardEvent } from 'react';

const OWN_KEYS: ReadonlySet<string> = new Set([
  ' ',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
]);

export function keepKeys(event: KeyboardEvent<HTMLElement>) {
  if (OWN_KEYS.has(event.key)) event.stopPropagation();
}
