import { ApiError, api, getSessionId } from './api';
import { preferredDataBase } from './api-client';
import { trackedInvoke as invoke } from './diagnostics';
import { fetchAllPlaylistTracks, fetchLikedTracksSnapshot, invalidateAllLikesCache } from './hooks';
import { createChunkPlaylist, likeTracks, listMyPlaylists } from './import-save';
import type { SyncEntry, SyncPulled } from './import-sync';
import { type Chunk, planAppend } from './import-sync-plan';
import { editPlaylistTracks } from './playlist-edits';
import { queryClient } from './query-client';
import { fetchTracksByUrns } from './soundwave';

export interface Current {
  urns: string[];
  chunks: Chunk[];
}

export async function currentOf(entry: SyncEntry): Promise<Current> {
  if (entry.target.mode === 'playlist') {
    const chunks: Chunk[] = [];
    const urns: string[] = [];
    for (const urn of entry.target.urns) {
      const tracks = await fetchAllPlaylistTracks(urn);
      chunks.push({ urn, count: tracks.length });
      urns.push(...tracks.map((track) => track.urn));
    }
    return { urns, chunks };
  }
  invalidateAllLikesCache();
  const likes = await fetchLikedTracksSnapshot();
  if (!likes.complete) throw 'search_unavailable';
  return { urns: likes.tracks.map((track) => track.urn), chunks: [] };
}

export async function titleOf(playlistUrn: string): Promise<string> {
  const playlist = await api<{ title: string }>(`/playlists/${encodeURIComponent(playlistUrn)}`);
  return playlist.title;
}

export function pull(entry: SyncEntry, current: string[], baseline: boolean) {
  return invoke<SyncPulled>('import_sync_pull', {
    input: {
      request: entry.request,
      baseline,
      seen: entry.seen,
      added: entry.added,
      latest: entry.latest,
      removed: entry.removed,
      current,
    },
    backendUrl: preferredDataBase(),
    sessionId: getSessionId() || '',
  });
}

async function addTo(playlist: string, urns: string[]) {
  for (const urn of urns) await editPlaylistTracks(playlist, { add: urn });
}

async function openChunk(owner: string, title: string, urns: string[]): Promise<string> {
  const found = (await listMyPlaylists()).find((playlist) => playlist.title === title);
  if (found) {
    const have = new Set((await fetchAllPlaylistTracks(found.urn)).map((track) => track.urn));
    await addTo(
      found.urn,
      urns.filter((urn) => !have.has(urn)),
    );
    return found.urn;
  }
  const made = await createChunkPlaylist(owner, title, urns);
  if (!made) throw 'playlist_not_synced';
  return made.urn;
}

export async function append(
  entry: SyncEntry,
  current: Current,
  urns: string[],
  owner: string,
  onChunk: (urn: string) => void,
) {
  if (urns.length === 0) return;
  if (entry.target.mode === 'likes') {
    const tracks = await fetchTracksByUrns(urns);
    await likeTracks(
      tracks,
      () => undefined,
      () => true,
    );
    return;
  }
  for (const step of planAppend(entry.baseTitle, current.chunks, urns)) {
    if (step.urn) await addTo(step.urn, step.urns);
    else onChunk(await openChunk(owner, step.title, step.urns));
  }
  for (const key of [['playlist'], ['me', 'playlists']]) {
    queryClient.invalidateQueries({ queryKey: key }).catch(() => undefined);
  }
}

export function isGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
