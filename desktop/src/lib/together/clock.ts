import type { RoomPlayback } from './types';

const SAMPLE_LIMIT = 8;

export interface ClockSample {
  offset: number;
  rtt: number;
}

export function clockSample(sentAt: number, receivedAt: number, serverNow: number): ClockSample {
  return { rtt: receivedAt - sentAt, offset: serverNow - (sentAt + receivedAt) / 2 };
}

export function addSample(samples: ClockSample[], sample: ClockSample): ClockSample[] {
  return [...samples, sample].slice(-SAMPLE_LIMIT);
}

function bestSample(samples: ClockSample[]): ClockSample | null {
  let best: ClockSample | null = null;
  for (const sample of samples) {
    if (!best || sample.rtt < best.rtt) best = sample;
  }
  return best;
}

export function bestOffset(samples: ClockSample[]): number {
  return bestSample(samples)?.offset ?? 0;
}

export function oneWayDelay(samples: ClockSample[]): number {
  return (bestSample(samples)?.rtt ?? 0) / 2;
}

export function positionAt(playback: RoomPlayback, serverTime: number): number {
  if (playback.status !== 'playing') return playback.positionMs;
  return playback.positionMs + (serverTime - playback.at) * playback.rate;
}
