import { type RefObject, useEffect } from 'react';

const MODAL_OPEN_MS = 220;

export function useFocusLater(ref: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => ref.current?.focus(), MODAL_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [open, ref]);
}

export function modalOpen(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

export function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}
