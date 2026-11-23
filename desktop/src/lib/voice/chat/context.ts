import type { Screen } from '../screen/shape';
import type { Entity, VoiceCommand } from '../types';
import type { RepeatMode } from '../undo';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const QUEUE_TAIL = 5;
const CANDIDATES_MAX = 5;

export interface Brief {
  title: string;
  artist: string;
}

export type SleepShown = { minutes_left: number } | 'track_end';

export interface RoomShown {
  role: 'host' | 'guest';
  code: string;
  listeners: number;
  open?: true;
}

export interface Extras {
  disliked: boolean;
  superliked: boolean;
  sleep: SleepShown | null;
  effect: string | null;
  room: RoomShown | null;
  talking?: boolean;
}

export interface ContextInput {
  track: Brief | null;
  liked: boolean;
  position: number;
  duration: number;
  playing: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  next: Brief[];
  candidates: Entity[];
  page: string;
  screen: Screen | null;
  now: Date;
  appLanguage: string;
  extras?: Extras;
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

export function localTime(now: Date): string {
  const date = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  return `${date} ${two(now.getHours())}:${two(now.getMinutes())}`;
}

export function candidatesOf(cmd: VoiceCommand): Entity[] {
  return (cmd.candidates ?? []).slice(0, CANDIDATES_MAX);
}

export function entityRef(entity: Entity) {
  return {
    kind: entity.kind,
    name: entity.name,
    artist: entity.artist,
    popularity: entity.popularity,
    id: entity.id,
  };
}

function taste(extras: Extras | undefined) {
  return {
    ...(extras?.disliked ? { disliked: true } : {}),
    ...(extras?.superliked ? { superliked: true } : {}),
  };
}

function extrasShown(extras: Extras | undefined) {
  if (!extras) return {};
  return {
    ...(extras.sleep ? { sleep_timer: extras.sleep } : {}),
    ...(extras.effect ? { effect: extras.effect } : {}),
    ...(extras.room ? { together: extras.room } : {}),
    ...(extras.talking ? { talk_mode: true } : {}),
  };
}

export function buildContext(input: ContextInput): Record<string, unknown> {
  const candidates = input.candidates.map(entityRef);
  return {
    now_playing: input.track
      ? {
          title: input.track.title,
          artist: input.track.artist,
          liked: input.liked,
          ...taste(input.extras),
          position: Math.round(input.position),
          duration: Math.round(input.duration),
        }
      : null,
    playing: input.playing,
    volume: input.volume,
    shuffle: input.shuffle,
    repeat: input.repeat,
    queue_next: input.next.slice(0, QUEUE_TAIL),
    page: input.page,
    time: localTime(input.now),
    weekday: WEEKDAYS[input.now.getDay()],
    app_language: input.appLanguage,
    ...extrasShown(input.extras),
    ...(candidates.length > 0 ? { candidates } : {}),
    ...(input.screen ? { screen: input.screen } : {}),
  };
}
