import type { Track } from '../stores/player';
import { ApiError, api } from './api';
import {
  forgetOwnedPlaylists,
  loadOwnedPlaylists,
  rememberOwnedPlaylists,
} from './import-owned-playlists';
import { loadPendingCreates, rememberPendingCreate } from './import-pending-playlists';
import { setTrackLiked } from './like-toggle';
import { editPlaylistTracks } from './playlist-edits';
import { queryClient } from './query-client';
import { fetchSyncStatus, type PlaylistCreate } from './sync-status';

const PLAYLIST_TRACK_LIMIT = 500;
const PLAYLIST_CONFLICT_RETRIES = 3;
const PLAYLIST_CONFLICT_PAUSE_SEC = 5;

export interface ScPlaylist {
  urn: string;
  title: string;
  track_count: number;
  artwork_url: string | null;
  permalink_url: string;
  user: { username: string };
}

interface QueuedPlaylistMutation {
  status: 'queued';
  actionType: string;
  targetUrn: string;
}

interface PlaylistTracksPage {
  sync: { projectionRevision: number };
}

export type ImportPendingState = 'queued' | 'delayed' | 'failed' | 'relogin';

export interface ImportPendingCreate {
  title: string;
  targetUrn: string | null;
  state: PlaylistCreate['state'];
}

export interface SavePlan {
  baseTitle: string;
  likes: boolean;
  owner: string;
  urns: string[];
  deleteStale: boolean;
  isActive: () => boolean;
}

export interface SaveResult {
  saved: ScPlaylist[];
  waiting: ImportPendingCreate[];
  needsRelogin: boolean;
  failure: unknown;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function chunkTitle(base: string, index: number): string {
  return index === 0 ? base : `${base} ${index + 1}`;
}

function chunkIndexOf(base: string, title: string): number | null {
  if (title === base) return 0;
  if (!title.startsWith(`${base} `)) return null;
  const suffix = title.slice(base.length + 1);
  if (!/^\d+$/.test(suffix)) return null;
  const parsed = Number.parseInt(suffix, 10);
  return parsed >= 2 ? parsed - 1 : null;
}

function isScPlaylist(value: unknown): value is ScPlaylist {
  if (!value || typeof value !== 'object') return false;
  return (
    typeof (value as ScPlaylist).urn === 'string' && typeof (value as ScPlaylist).title === 'string'
  );
}

export function isPlaylistConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findExistingPlaylists(
  base: string,
  likes: boolean,
  owned: Set<string>,
): Promise<ScPlaylist[]> {
  const all: ScPlaylist[] = [];

  for (let page = 0; ; page++) {
    const res = await api<{ collection: ScPlaylist[]; has_more: boolean }>(
      `/me/playlists?limit=200&page=${page}`,
    );
    all.push(...(res.collection ?? []));
    if (!res.has_more) break;
  }

  return all.filter(
    (playlist) => chunkIndexOf(base, playlist.title) != null && (likes || owned.has(playlist.urn)),
  );
}

async function replacePlaylistTracks(playlistUrn: string, urns: string[]) {
  const path = `/playlists/${encodeURIComponent(playlistUrn)}`;

  for (let retry = 0; ; retry++) {
    const { sync } = await api<PlaylistTracksPage>(`${path}/tracks?limit=1&page=0`);
    try {
      await api(`${path}?replace=true`, {
        method: 'PUT',
        silentStatuses: [409],
        body: JSON.stringify({
          playlist: { tracks: urns.map((urn) => ({ urn })) },
          expectedProjectionRevision: sync.projectionRevision,
        }),
      });
      return;
    } catch (error) {
      if (!isPlaylistConflict(error) || retry >= PLAYLIST_CONFLICT_RETRIES) throw error;
      await wait((error.retryAfterSeconds ?? PLAYLIST_CONFLICT_PAUSE_SEC) * 1000);
    }
  }
}

function createPlaylist(title: string, urns: string[]) {
  return api<ScPlaylist | QueuedPlaylistMutation>('/playlists', {
    method: 'POST',
    body: JSON.stringify({
      playlist: {
        title,
        sharing: 'private',
        tracks: urns.map((urn) => ({ urn })),
      },
    }),
  });
}

async function deleteStalePlaylists(
  plan: SavePlan,
  owned: Set<string>,
  existing: ScPlaylist[],
  targetCount: number,
) {
  const stalePlaylists = existing.filter((playlist) => {
    const index = chunkIndexOf(plan.baseTitle, playlist.title);
    return index != null && index >= targetCount && owned.has(playlist.urn);
  });

  const deleted = await Promise.all(
    stalePlaylists.map((playlist) =>
      api(`/playlists/${encodeURIComponent(playlist.urn)}`, { method: 'DELETE' }).then(
        () => playlist.urn,
        () => null,
      ),
    ),
  );
  await forgetOwnedPlaylists(
    plan.owner,
    deleted.filter((urn): urn is string => urn != null),
  );
}

export function pendingStateOf(
  creates: ImportPendingCreate[],
  needsRelogin: boolean,
): ImportPendingState | null {
  if (creates.length === 0) return null;
  if (needsRelogin) return 'relogin';
  if (creates.some((create) => create.state === 'failed')) return 'failed';
  if (creates.some((create) => create.state === 'delayed')) return 'delayed';
  return 'queued';
}

export async function saveChunks(plan: SavePlan): Promise<SaveResult | null> {
  const owned = await loadOwnedPlaylists(plan.owner);
  const existing = await findExistingPlaylists(plan.baseTitle, plan.likes, owned);
  const sync = await fetchSyncStatus().catch(() => null);
  const serverCreates = new Map<string, PlaylistCreate>();
  for (const create of sync?.playlistCreates ?? []) {
    if (!serverCreates.has(create.title)) serverCreates.set(create.title, create);
  }
  const pending = await loadPendingCreates(
    plan.owner,
    existing,
    sync?.playlistCreates ?? null,
    sync?.playlistCreatesTruncated ?? false,
  );
  await rememberOwnedPlaylists(plan.owner, pending.createdUrns);
  if (!plan.isActive()) return null;

  const chunks = chunkArray(plan.urns, PLAYLIST_TRACK_LIMIT);
  const saved: ScPlaylist[] = [];
  const waiting: ImportPendingCreate[] = [];
  let failure: unknown = null;

  for (const [index, urns] of chunks.entries()) {
    const title = chunkTitle(plan.baseTitle, index);
    const existingPlaylist = existing.find((playlist) => playlist.title === title);
    const server = existingPlaylist ? undefined : serverCreates.get(title);
    if (server) {
      waiting.push({ title, targetUrn: server.targetUrn, state: server.state });
      continue;
    }
    if (pending.titles.has(title)) {
      waiting.push({ title, targetUrn: null, state: 'queued' });
      continue;
    }
    try {
      if (existingPlaylist) {
        await replacePlaylistTracks(existingPlaylist.urn, urns);
        saved.push(existingPlaylist);
      } else {
        const result = await createPlaylist(title, urns);
        if (isScPlaylist(result)) {
          saved.push(result);
          await rememberOwnedPlaylists(plan.owner, [result.urn]);
        } else {
          waiting.push({ title, targetUrn: result.targetUrn, state: 'queued' });
          await rememberPendingCreate(plan.owner, title, result.targetUrn);
        }
      }
    } catch (error) {
      console.error(`[Import] saving "${title}" failed:`, error);
      failure ??= error;
    }
    if (!plan.isActive()) return null;
  }

  if (plan.deleteStale && !failure) {
    await deleteStalePlaylists(plan, owned, existing, chunks.length);
    if (!plan.isActive()) return null;
  }

  return { saved, waiting, needsRelogin: sync?.needsRelogin ?? false, failure };
}

export async function likeTracks(
  tracks: Track[],
  onStep: (done: number) => void,
  isActive: () => boolean,
) {
  const oldestFirst = [...tracks].reverse();
  for (const [index, track] of oldestFirst.entries()) {
    if (!isActive()) return;
    await setTrackLiked(queryClient, track, true);
    onStep(index + 1);
  }
}

export async function addToPlaylist(
  playlistUrn: string,
  urns: string[],
  onStep: (done: number) => void,
  isActive: () => boolean,
) {
  for (const [index, urn] of urns.entries()) {
    if (!isActive()) return;
    await editPlaylistTracks(playlistUrn, { add: urn });
    onStep(index + 1);
  }
  queryClient.invalidateQueries({ queryKey: ['playlist', playlistUrn] }).catch(() => undefined);
  queryClient
    .invalidateQueries({ queryKey: ['playlist', playlistUrn, 'tracks'] })
    .catch(() => undefined);
  queryClient.invalidateQueries({ queryKey: ['me', 'playlists'] }).catch(() => undefined);
}
