export const OUTBOX_LIMIT = 3000;
export const SAME_PLAY_MS = 60_000;
export const LOCAL_ID = 'local:';

export interface PlayBody {
  scTrackId: string;
  title: string;
  artistName: string;
  artistUrn: string | null;
  artworkUrl: string | null;
  duration: number;
}

export interface QueuedPlay {
  kind: 'play';
  id: string;
  user: string | null;
  playedAt: number;
  body: PlayBody;
  ms: number;
}

export interface QueuedListened {
  kind: 'listened';
  id: string;
  user: string | null;
  ms: number;
}

export type OutboxItem = QueuedPlay | QueuedListened;

export function withPlay(items: OutboxItem[], play: QueuedPlay): OutboxItem[] {
  return [...items, play].slice(-OUTBOX_LIMIT);
}

export function withListened(
  items: OutboxItem[],
  id: string,
  user: string | null,
  ms: number,
): OutboxItem[] {
  if (!items.some((item) => item.id === id)) {
    if (id.startsWith(LOCAL_ID)) return items;
    return [...items, { kind: 'listened' as const, id, user, ms }].slice(-OUTBOX_LIMIT);
  }
  return items.map((item) => (item.id === id ? { ...item, ms: Math.max(item.ms, ms) } : item));
}

export function afterPlaySent(
  items: OutboxItem[],
  localId: string,
  serverId: string | null,
): OutboxItem[] {
  return items.flatMap((item) => {
    if (item.kind !== 'play' || item.id !== localId) return [item];
    if (!serverId || item.ms <= 0) return [];
    return [{ kind: 'listened' as const, id: serverId, user: item.user, ms: item.ms }];
  });
}

export function afterListenedSent(items: OutboxItem[], id: string, ms: number): OutboxItem[] {
  return items.filter((item) => item.kind !== 'listened' || item.id !== id || item.ms > ms);
}

export function without(items: OutboxItem[], dropped: OutboxItem): OutboxItem[] {
  return items.filter((item) => item.kind !== dropped.kind || item.id !== dropped.id);
}

export function nextFor(items: OutboxItem[], user: string): OutboxItem | undefined {
  return items.find((item) => item.user === null || item.user === user);
}

export function ownedBy(items: OutboxItem[]): OutboxItem[] {
  return items.filter((item) => item.user !== null);
}
