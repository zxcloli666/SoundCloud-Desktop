import type { RepeatMode } from '../undo';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const QUEUE_TAIL = 5;

export interface Brief {
  title: string;
  artist: string;
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
  page: string;
  now: Date;
  appLanguage: string;
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

export function localTime(now: Date): string {
  const date = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  return `${date} ${two(now.getHours())}:${two(now.getMinutes())}`;
}

export function buildContext(input: ContextInput): Record<string, unknown> {
  return {
    now_playing: input.track
      ? {
          title: input.track.title,
          artist: input.track.artist,
          liked: input.liked,
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
  };
}
