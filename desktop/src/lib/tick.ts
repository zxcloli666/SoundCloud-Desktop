import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let timer = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = window.setInterval(() => {
      for (const notify of listeners) notify();
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.clearInterval(timer);
  };
}

const idle = () => () => {};

export const nowSec = () => Math.floor(Date.now() / 1000);

export function useTick<T>(snapshot: () => T, live = true): T {
  return useSyncExternalStore(live ? subscribe : idle, snapshot);
}

export function useSecondsLeft(until: number, live = true): number {
  return useTick(() => Math.max(0, until - nowSec()), live);
}

export function usePassed(at: number | null, live = true): boolean {
  return useTick(() => at !== null && nowSec() >= at, live && at !== null);
}

export function useNowMs(stepMs: number, live = true): number {
  return useTick(() => Math.floor(Date.now() / stepMs) * stepMs, live);
}
