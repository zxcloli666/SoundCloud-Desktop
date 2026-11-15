import { type KeyboardEvent, useRef } from 'react';

const FORWARD = new Set(['ArrowRight', 'ArrowDown']);
const BACKWARD = new Set(['ArrowLeft', 'ArrowUp']);

function stepOf(event: KeyboardEvent<HTMLInputElement>): number {
  if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return 0;
  const { selectionStart, selectionEnd, value } = event.currentTarget;
  if (selectionStart !== selectionEnd) return 0;
  if (FORWARD.has(event.key) && selectionEnd === value.length) return 1;
  if (BACKWARD.has(event.key) && selectionStart === 0) return -1;
  return 0;
}

export function useFieldHops() {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const slot = (at: number) => (input: HTMLInputElement | null) => {
    inputs.current[at] = input;
  };
  const hop = (at: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    const step = stepOf(event);
    const target = step ? inputs.current[at + step] : null;
    if (!target) return;
    event.preventDefault();
    target.focus();
    const caret = step > 0 ? 0 : target.value.length;
    target.setSelectionRange(caret, caret);
  };
  return { slot, hop };
}
