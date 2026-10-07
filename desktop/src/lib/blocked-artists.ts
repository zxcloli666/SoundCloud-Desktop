import {
  type BlockedArtist,
  type BlockKind,
  sameTarget,
  useBlockedArtistsStore,
  whenBlocklistHydrated,
} from '../stores/blocked-artists';
import type { Track } from '../stores/player';
import { api } from './api';
import { idOf } from './ids';

interface BlockIndex {
  users: Set<string>;
  artists: Set<string>;
}

let indexSource: BlockedArtist[] | null = null;
let index: BlockIndex = { users: new Set(), artists: new Set() };

function indexFor(entries: BlockedArtist[]): BlockIndex {
  if (entries !== indexSource) {
    const users = new Set<string>();
    const artists = new Set<string>();
    for (const e of entries) {
      if (e.kind === 'artist') artists.add(e.id);
      else users.add(e.id);
      for (const id of e.sc_user_ids) users.add(id);
    }
    indexSource = entries;
    index = { users, artists };
  }
  return index;
}

function bareUserId(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const raw = String(value);
  return idOf(raw) ?? (/^\d+$/.test(raw) ? raw : null);
}

function blockedIn({ users, artists }: BlockIndex, track: Track): boolean {
  if (users.size === 0 && artists.size === 0) return false;
  const uploader = bareUserId(track.user?.urn) ?? bareUserId(track.user?.id);
  if (uploader && users.has(uploader)) return true;
  const enrichment = track.enrichment;
  if (!enrichment) return false;
  const primary = enrichment.primary_artist;
  if (primary) {
    if (artists.has(primary.id)) return true;
    const linked = bareUserId(primary.sc_user_id);
    if (linked && users.has(linked)) return true;
  }
  return enrichment.participants?.some((p) => artists.has(p.artist.id)) ?? false;
}

export function blockedArtistMatcher(entries: BlockedArtist[]): (track: Track) => boolean {
  const idx = indexFor(entries);
  return (track) => blockedIn(idx, track);
}

export function isTrackBlocked(track: Track | null | undefined): boolean {
  if (!track) return false;
  return blockedIn(indexFor(useBlockedArtistsStore.getState().entries), track);
}

export function useIsBlocked(kind: BlockKind, id: string | null | undefined): boolean {
  return useBlockedArtistsStore((s) => !!id && s.entries.some((e) => sameTarget(e, kind, id)));
}

export function useBlocklistVersion(): BlockedArtist[] {
  return useBlockedArtistsStore((s) => s.entries);
}

function targetPath(kind: BlockKind, id: string) {
  return `/blocked-artists/${kind}/${encodeURIComponent(id)}`;
}

export async function loadBlockedArtists(owner: string): Promise<void> {
  await whenBlocklistHydrated();
  const store = useBlockedArtistsStore.getState();
  if (store.owner && store.owner !== owner) store.setEntries(owner, []);
  const res = await api<{ collection: BlockedArtist[] }>('/blocked-artists').catch(() => null);
  if (res) useBlockedArtistsStore.getState().setEntries(owner, res.collection ?? []);
}

export async function blockArtist(entry: Omit<BlockedArtist, 'created_at'>): Promise<boolean> {
  useBlockedArtistsStore.getState().upsert({ ...entry, created_at: new Date().toISOString() });
  try {
    const saved = await api<BlockedArtist>(targetPath(entry.kind, entry.id), {
      method: 'PUT',
      body: JSON.stringify({
        name: entry.name,
        avatar_url: entry.avatar_url ?? null,
        sc_user_ids: entry.sc_user_ids,
      }),
    });
    useBlockedArtistsStore.getState().upsert(saved);
    return true;
  } catch {
    useBlockedArtistsStore.getState().remove(entry.kind, entry.id);
    return false;
  }
}

export async function unblockArtist(kind: BlockKind, id: string): Promise<boolean> {
  const previous = useBlockedArtistsStore.getState().entries.find((e) => sameTarget(e, kind, id));
  useBlockedArtistsStore.getState().remove(kind, id);
  try {
    await api(targetPath(kind, id), { method: 'DELETE' });
    return true;
  } catch {
    if (previous) useBlockedArtistsStore.getState().upsert(previous);
    return false;
  }
}

export type { BlockedArtist, BlockKind };
