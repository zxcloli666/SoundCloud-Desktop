import { useSyncExternalStore } from 'react';

const query = window.matchMedia('(prefers-reduced-motion: reduce)');

function subscribe(callback: () => void) {
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => query.matches);
}
