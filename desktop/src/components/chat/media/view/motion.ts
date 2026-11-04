import { useSyncExternalStore } from 'react';
import { usePerfMode } from '../../../../lib/perf';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function reduced(): boolean {
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, reduced, () => false);
}

export function useCalmMotion(): boolean {
  const perf = usePerfMode();
  return useReducedMotion() || perf.mode === 'light';
}
