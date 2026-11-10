import { type RefObject, useEffect, useState, useSyncExternalStore } from 'react';
import { type PerfMode, usePerfMode } from '../../../lib/perf';

export type Motion = { kind: 'live'; fps: number } | { kind: 'still' } | { kind: 'paused' };

const FPS: Record<PerfMode, number> = { beauty: 30, medium: 15, light: 0 };
const REDUCED = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function reduced() {
  return window.matchMedia(REDUCED).matches;
}

function subscribeHidden(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function hidden() {
  return document.visibilityState === 'hidden';
}

function useOnScreen(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return onScreen;
}

export function useMotion(ref: RefObject<HTMLElement | null>, held: boolean): Motion {
  const perf = usePerfMode();
  const still = useSyncExternalStore(subscribeReduced, reduced);
  const away = useSyncExternalStore(subscribeHidden, hidden);
  const fps = FPS[perf.mode];
  const animated = fps > 0 && !still;
  const onScreen = useOnScreen(ref, animated);
  if (!animated) return { kind: 'still' };
  if (away || held || !onScreen) return { kind: 'paused' };
  return { kind: 'live', fps };
}
