import { type RefObject, useCallback, useEffect, useRef } from 'react';

const MODAL_OPEN_MS = 220;

export function useFocusLater(ref: RefObject<HTMLElement | null>, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => ref.current?.focus(), MODAL_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [open, ref]);
}

export function useStableClose(close: () => void): (open: boolean) => void {
  const latest = useRef(close);
  latest.current = close;
  return useCallback((open: boolean) => {
    if (!open) latest.current();
  }, []);
}

export function modalOpen(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

export function typingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

export function focusGridSoon() {
  window.setTimeout(() => {
    const active = document.activeElement;
    if (active && active !== document.body && document.contains(active)) return;
    document.querySelector<HTMLElement>('[data-ui="chat-storage-grid"] [data-tile]')?.focus();
  }, MODAL_OPEN_MS + 60);
}
