import type { Track } from '../../stores/player';

export type LiveState =
  | 'fresh'
  | 'cached'
  | 'stale'
  | 'local'
  | 'limited'
  | 'busy'
  | 'paused'
  | 'cooling'
  | 'unavailable'
  | 'timeout'
  | 'off'
  | 'skipped';

export interface LiveMeta {
  state: LiveState;
  retry_after_sec?: number | null;
  local?: 'unavailable' | null;
}

export type SearchIntent = 'sc' | 'fill';

export interface ScdSearchTag {
  source: 'soundcloud' | 'local';
  score?: number;
}

const TRANSIENT: ReadonlySet<string> = new Set<LiveState>([
  'limited',
  'busy',
  'cooling',
  'paused',
  'unavailable',
  'timeout',
]);

export function isTransientLive(state: string | undefined): boolean {
  return !!state && TRANSIENT.has(state);
}

export function liveOf(
  data: { pages: Array<{ live?: LiveMeta }> } | undefined,
): LiveMeta | undefined {
  return data?.pages[0]?.live;
}

const SEARCHED: ReadonlySet<string> = new Set<LiveState>([
  'fresh',
  'cached',
  'stale',
  'local',
  'skipped',
]);

export function liveSearched(state: string | undefined): boolean {
  return !!state && SEARCHED.has(state);
}

export function isLiveTile(track: Track): boolean {
  return track._scd_search?.source === 'soundcloud';
}
