import type { Track } from '../../stores/player';
import type { Intent } from './types';

export type Scope =
  | 'track'
  | 'playing'
  | 'position'
  | 'volume'
  | 'like'
  | 'shuffle'
  | 'repeat'
  | 'queue';
export type RepeatMode = 'off' | 'one' | 'all';

export interface PlayerShot {
  track: Track | null;
  queue: Track[];
  queueIndex: number;
  originalQueue: Track[] | null;
  position: number;
  playing: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  liked: boolean;
}

export interface UndoStep {
  scope: Scope[];
  before: PlayerShot;
  after: PlayerShot;
}

export interface UndoEntry {
  id: string;
  at: number;
  steps: UndoStep[];
}

export const UNDO_TTL_MS = 30 * 60 * 1000;
const STACK_CAP = 20;

const SCOPES: Partial<Record<Intent, Scope[]>> = {
  play: ['track'],
  play_likes: ['track'],
  play_wave: ['track'],
  play_similar: ['track'],
  next: ['track'],
  previous: ['track'],
  pause: ['playing'],
  resume: ['playing'],
  stop: ['playing'],
  seek_forward: ['position'],
  seek_backward: ['position'],
  seek_to: ['position'],
  volume_up: ['volume'],
  volume_down: ['volume'],
  volume_set: ['volume'],
  mute: ['volume'],
  unmute: ['volume'],
  like: ['like'],
  unlike: ['like'],
  shuffle_on: ['shuffle'],
  shuffle_off: ['shuffle'],
  repeat_one: ['repeat'],
  repeat_all: ['repeat'],
  repeat_off: ['repeat'],
  queue_add: ['queue'],
};

export function scopeOf(intent: Intent): Scope[] {
  return SCOPES[intent] ?? [];
}

function urnOf(shot: PlayerShot): string | null {
  return shot.track?.urn ?? null;
}

function sameTrack(a: PlayerShot, b: PlayerShot): boolean {
  return urnOf(a) !== null && urnOf(a) === urnOf(b);
}

function holds(scope: Scope, step: UndoStep, now: PlayerShot): boolean {
  const { before, after } = step;
  switch (scope) {
    case 'track': {
      const started = urnOf(after);
      if (!started) return false;
      const head = after.queue[0]?.urn;
      return now.queue[0]?.urn === head && now.queue.some((t) => t.urn === started);
    }
    case 'playing':
      return sameTrack(now, after) && now.playing === after.playing;
    case 'position':
      return sameTrack(now, after);
    case 'volume':
      return now.volume === after.volume;
    case 'like':
      return sameTrack(now, after) && now.liked === after.liked;
    case 'shuffle':
      return now.shuffle === after.shuffle;
    case 'repeat':
      return now.repeat === after.repeat;
    case 'queue': {
      const had = new Set(before.queue.map((t) => t.urn));
      const added = after.queue.filter((t) => !had.has(t.urn)).map((t) => t.urn);
      const present = new Set(now.queue.map((t) => t.urn));
      return added.length > 0 && added.every((urn) => present.has(urn));
    }
  }
}

export function stillValid(entry: UndoEntry, nowMs: number, now: PlayerShot): boolean {
  if (nowMs - entry.at > UNDO_TTL_MS) return false;
  const checked = new Set<Scope>();
  for (let i = entry.steps.length - 1; i >= 0; i--) {
    const step = entry.steps[i];
    for (const scope of step.scope) {
      if (checked.has(scope)) continue;
      checked.add(scope);
      if (!holds(scope, step, now)) return false;
    }
  }
  return checked.size > 0;
}

export function pushStep(stack: UndoEntry[], id: string, step: UndoStep, at: number): UndoEntry[] {
  const top = stack[stack.length - 1];
  if (top && top.id === id) {
    return [...stack.slice(0, -1), { ...top, steps: [...top.steps, step] }];
  }
  return [...stack, { id, at, steps: [step] }].slice(-STACK_CAP);
}

export function removeEntry(stack: UndoEntry[], id: string): UndoEntry[] {
  return stack.filter((e) => e.id !== id);
}

export function findEntry(stack: UndoEntry[], id: string): UndoEntry | null {
  return stack.find((e) => e.id === id) ?? null;
}

export function topValid(stack: UndoEntry[], nowMs: number, now: PlayerShot): UndoEntry | null {
  const top = stack[stack.length - 1];
  return top && stillValid(top, nowMs, now) ? top : null;
}

export function stepsToRevert(entry: UndoEntry): UndoStep[] {
  return [...entry.steps].reverse();
}
