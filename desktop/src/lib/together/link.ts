import { useTogetherStore } from '../../stores/together';
import type { Timed } from './api';
import { addSample, bestOffset, type ClockSample, clockSample, oneWayDelay } from './clock';
import type { RoomView } from './types';

export interface RoomRole {
  onView: (view: RoomView) => void;
  detach: () => void;
}

let samples: ClockSample[] = [];
let viewListener: ((view: RoomView, previous: RoomView | null) => void) | null = null;

export function resetClock(): void {
  samples = [];
}

export function serverTime(): number {
  return Date.now() + bestOffset(samples);
}

export function oneWayMs(): number {
  return oneWayDelay(samples);
}

export function setViewListener(
  listener: ((view: RoomView, previous: RoomView | null) => void) | null,
): void {
  viewListener = listener;
}

export function acceptView(view: RoomView): void {
  const { room, phase } = useTogetherStore.getState();
  if (phase === 'idle' || !room || room.code !== view.code || view.version < room.version) return;
  useTogetherStore.setState({ room: view });
  viewListener?.(view, room);
}

export function acceptTimed(timed: Timed, sampleClock = true): void {
  if (sampleClock) {
    samples = addSample(samples, clockSample(timed.sentAt, timed.receivedAt, timed.view.serverNow));
  }
  acceptView(timed.view);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitForRoom(ready: () => boolean, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (ready()) {
      resolve();
      return;
    }
    const finish = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    const unsubscribe = useTogetherStore.subscribe(() => {
      if (ready()) finish();
    });
  });
}

export function onlineGuests(view: RoomView | null) {
  if (!view) return [];
  return view.members.filter((m) => m.userId !== view.hostId && view.online.includes(m.userId));
}
