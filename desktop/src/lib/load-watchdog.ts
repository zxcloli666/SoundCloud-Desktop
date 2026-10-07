import { useSettingsStore } from '../stores/settings';

const MAX_SKIP_STREAK = 3;

let timer: ReturnType<typeof setTimeout> | null = null;
let onStuck: (() => void) | null = null;
let skipStreak = 0;

function timeoutMs(): number {
  return useSettingsStore.getState().skipStuckAfterSec * 1000;
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  const ms = timeoutMs();
  if (!onStuck || ms <= 0) {
    timer = null;
    return;
  }
  timer = setTimeout(() => {
    const callback = onStuck;
    stopLoadWatch();
    callback?.();
  }, ms);
}

export function skipUnloadableEnabled(): boolean {
  return timeoutMs() > 0 && navigator.onLine !== false;
}

export function watchLoad(callback: () => void): void {
  onStuck = callback;
  schedule();
}

export function bumpLoadWatch(): void {
  if (onStuck) schedule();
}

export function stopLoadWatch(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  onStuck = null;
}

export function takeSkipAttempt(): boolean {
  if (skipStreak >= MAX_SKIP_STREAK) {
    skipStreak = 0;
    return false;
  }
  skipStreak++;
  return true;
}

export function resetSkipStreak(): void {
  skipStreak = 0;
}
