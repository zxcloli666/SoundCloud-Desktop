import { getSessionId } from './api';
import { preferredDataBase } from './api-client';
import { trackedInvoke as invoke } from './diagnostics';
import { fetchAllPlaylistTracks, fetchLikedTracksSnapshot, invalidateAllLikesCache } from './hooks';
import { likeTracks } from './import-save';
import { PLAYLIST_LIMIT, type SyncEntry, type SyncPulled } from './import-sync';
import { editPlaylistTracks } from './playlist-edits';
import { queryClient } from './query-client';
import { fetchTracksByUrns } from './soundwave';

export async function currentUrns(entry: SyncEntry): Promise<string[]> {
  if (entry.target.mode === 'playlist') {
    const tracks = await fetchAllPlaylistTracks(entry.target.urn);
    return tracks.map((track) => track.urn);
  }
  invalidateAllLikesCache();
  const likes = await fetchLikedTracksSnapshot();
  if (!likes.complete) throw 'search_unavailable';
  return likes.tracks.map((track) => track.urn);
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

export async function append(entry: SyncEntry, urns: string[]) {
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
  const playlist = entry.target.urn;
  for (const urn of urns) await editPlaylistTracks(playlist, { add: urn });
  for (const key of [
    ['playlist', playlist],
    ['playlist', playlist, 'tracks'],
    ['me', 'playlists'],
  ]) {
    queryClient.invalidateQueries({ queryKey: key }).catch(() => undefined);
  }
}

export function roomFor(entry: SyncEntry, current: string[]): number {
  return entry.target.mode === 'playlist'
    ? Math.max(0, PLAYLIST_LIMIT - current.length)
    : Number.POSITIVE_INFINITY;
}
