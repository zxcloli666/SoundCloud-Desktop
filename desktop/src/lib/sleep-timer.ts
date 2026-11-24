import { usePlayerStore } from '../stores/player';
import { type SleepTimer, useSleepTimerStore } from '../stores/sleep-timer';
import {
  applyVolume,
  getCurrentTime,
  getDuration,
  holdTrackEnd,
  subscribe,
  subscribeTrackEnd,
} from './audio';

export const SLEEP_MINUTES = [15, 30, 45, 60];

const FADE_MS = 15_000;
const FADE_TICK_MS = 100;
const IDLE_TICK_MS = 1000;

let stopWatching: (() => void) | null = null;
let fading = false;

function fadeTo(leftMs: number) {
  fading = true;
  applyVolume((Math.max(0, leftMs) / FADE_MS) ** 2);
}

function restoreVolume() {
  if (!fading) return;
  fading = false;
  applyVolume();
}

function finish() {
  stopWatching?.();
  stopWatching = null;
  useSleepTimerStore.setState({ timer: null });
  usePlayerStore.getState().pause();
  restoreVolume();
}

function watchTime(endsAt: number) {
  let id = 0;
  const step = () => {
    const left = endsAt - Date.now();
    if (left <= 0) {
      finish();
      return;
    }
    if (left <= FADE_MS) fadeTo(left);
    id = window.setTimeout(step, left <= FADE_MS + IDLE_TICK_MS ? FADE_TICK_MS : IDLE_TICK_MS);
  };
  step();
  return () => window.clearTimeout(id);
}

function watchTrackEnd() {
  holdTrackEnd(true);
  const unsubscribeTick = subscribe(() => {
    const duration = getDuration();
    if (duration <= 0) return;
    const { playbackRate } = usePlayerStore.getState();
    const leftMs = ((duration - getCurrentTime()) / playbackRate) * 1000;
    if (leftMs <= FADE_MS) fadeTo(leftMs);
    else restoreVolume();
  });
  const unsubscribeEnd = subscribeTrackEnd(finish);
  return () => {
    holdTrackEnd(false);
    unsubscribeTick();
    unsubscribeEnd();
  };
}

function begin(timer: SleepTimer) {
  cancelSleepTimer();
  useSleepTimerStore.setState({ timer });
  stopWatching = timer.kind === 'time' ? watchTime(timer.endsAt) : watchTrackEnd();
}

export function startSleepTimer(minutes: number) {
  begin({ kind: 'time', endsAt: Date.now() + minutes * 60_000 });
}

export function startSleepAtTrackEnd() {
  begin({ kind: 'track' });
}

export function cancelSleepTimer() {
  stopWatching?.();
  stopWatching = null;
  useSleepTimerStore.setState({ timer: null });
  restoreVolume();
}
