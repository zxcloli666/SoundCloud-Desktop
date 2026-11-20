import type { AlbumDetail } from '../../components/album/types';
import type { Track } from '../../stores/player';
import { usePlayerStore } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import { api } from '../api';
import { type PagedResponse, pagedUrl } from '../hooks';
import { toUrn, trackUrn } from '../ids';
import {
  armPlaylistContinuation,
  armTrackWaveContinuation,
  createLikesContinuationSource,
} from '../queue-continuation';
import { fetchSmartWave } from '../soundwave';
import type { Entity } from './types';

const QUIET = { quiet: true };
const ARTIST_TOP = 60;
const PLAYLIST_FIRST_PAGE = 50;

export interface EntityQueue {
  tracks: Track[];
  arm?: () => void;
}

async function artistTracks(id: string): Promise<EntityQueue> {
  const page = await api<{ collection: Track[] }>(
    `/artists/${encodeURIComponent(id)}/tracks?role=primary&sort=popular&limit=${ARTIST_TOP}`,
    QUIET,
  );
  return { tracks: page.collection };
}

async function albumTracks(id: string): Promise<EntityQueue> {
  const album = await api<AlbumDetail>(`/albums/${encodeURIComponent(id)}`, QUIET);
  return { tracks: album.tracks.filter((t) => t.enrichment?.availability !== 'wanted') };
}

async function playlistTracks(id: string): Promise<EntityQueue> {
  const urn = toUrn('playlists', id) ?? id;
  const page = await api<PagedResponse<Track>>(
    pagedUrl(`/playlists/${encodeURIComponent(urn)}/tracks`, 0, PLAYLIST_FIRST_PAGE),
    QUIET,
  );
  return { tracks: page.collection, arm: () => armPlaylistContinuation(urn) };
}

async function singleTrack(id: string): Promise<EntityQueue> {
  const urn = trackUrn(id) ?? id;
  const track = await api<Track>(`/tracks/${encodeURIComponent(urn)}`, QUIET);
  return { tracks: [track] };
}

export function entityQueue(entity: Entity): Promise<EntityQueue> {
  if (entity.kind === 'artist') return artistTracks(entity.id);
  if (entity.kind === 'album') return albumTracks(entity.id);
  if (entity.kind === 'playlist') return playlistTracks(entity.id);
  return singleTrack(entity.id);
}

export async function likesQueue(): Promise<EntityQueue> {
  const tracks = await createLikesContinuationSource(0).next();
  return { tracks };
}

export async function waveQueue(): Promise<EntityQueue> {
  const batch = await fetchSmartWave({
    seedKind: 'user',
    hideListened: useSettingsStore.getState().soundwaveHideListened,
  });
  return { tracks: batch.tracks };
}

export async function similarQueue(): Promise<EntityQueue> {
  const seed = trackUrn(usePlayerStore.getState().currentTrack?.urn);
  if (!seed) return { tracks: [] };
  const batch = await fetchSmartWave({
    seedKind: 'track',
    seedId: seed,
    hideListened: useSettingsStore.getState().soundwaveHideListened,
  });
  return { tracks: batch.tracks, arm: () => void armTrackWaveContinuation() };
}
