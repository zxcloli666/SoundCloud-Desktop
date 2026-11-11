import type { CollectionSyncInfo, CollectionSyncState } from './collection-sync';

export const LONG_WAIT_MS = 20_000;

export type WaitKind = 'syncing' | 'stalled';

const anchors = new Map<string, number>();

export function waitAnchor(
  scope: string,
  state: CollectionSyncState | null,
  queuedSince: string | null,
  now: number,
): number {
  if (state === 'complete') anchors.delete(scope);
  const queued = queuedSince ? Date.parse(queuedSince) : Number.NaN;
  if (!Number.isNaN(queued)) return queued;
  if (state !== 'syncing' && state !== 'stalled') return Number.NaN;
  const seen = anchors.get(scope) ?? now;
  anchors.set(scope, seen);
  return seen;
}

export function waitKindOf(query: {
  isError: boolean;
  syncInfo?: CollectionSyncInfo;
}): WaitKind | null {
  if (query.isError) return null;
  const state = query.syncInfo?.state;
  return state === 'syncing' || state === 'stalled' ? state : null;
}

export function longWaitLeft(kind: WaitKind, since: number, now: number): number {
  if (kind === 'stalled') return 0;
  return Math.max(0, since + LONG_WAIT_MS - now);
}

export function clockText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  if (hours === 0) return `${minutes}:${seconds}`;
  return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`;
}
