import type { KeyboardEvent } from 'react';

const STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export function moveRadioFocus(event: KeyboardEvent<HTMLDivElement>) {
  const step = STEPS[event.key];
  if (!step) return;
  const radios = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const at = radios.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  event.preventDefault();
  radios[(at + step + radios.length) % radios.length].focus();
}
