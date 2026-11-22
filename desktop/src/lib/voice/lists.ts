import { type Track, usePlayerStore } from '../../stores/player';
import { api } from '../api';
import type { HistoryEntry } from '../hooks';
import {
  armLikesContinuation,
  armSuperlikesContinuation,
  createLikesContinuationSource,
} from '../queue-continuation';
import { fetchAllSuperlikedTracks } from '../superlikes';
import { getTrackDisplay } from '../track-display';
import { entityQueue } from './entity-tracks';
import type { Listed, TrackList } from './track-lists';

const QUIET = { quiet: true };

function upcoming(): Track[] {
  const { queue, queueIndex } = usePlayerStore.getState();
  return queue.slice(queueIndex + 1);
}

async function likesUpTo(count: number): Promise<Track[]> {
  const source = createLikesContinuationSource(0);
  const tracks: Track[] = [];
  while (tracks.length < count) {
    const page = await source.next();
    if (page.length === 0) break;
    tracks.push(...page);
  }
  return tracks;
}

async function history(from: number, count: number): Promise<HistoryEntry[]> {
  const page = await api<{ collection: Partial<HistoryEntry>[] }>(
    `/history?limit=${count}&offset=${from - 1}`,
    QUIET,
  );
  return page.collection.filter((row): row is HistoryEntry => !!row.trackUrn);
}

function listedTrack(track: Track, n: number): Listed {
  const shown = getTrackDisplay(track);
  return { n, title: shown.title, artist: shown.artistLine, id: track.urn };
}

async function tracksUpTo(list: Exclude<TrackList, 'history'>, count: number): Promise<Track[]> {
  if (list === 'queue') return upcoming();
  if (list === 'likes') return likesUpTo(count);
  return fetchAllSuperlikedTracks();
}

const SCANNED: Record<TrackList, number> = {
  queue: 500,
  likes: 3000,
  superlikes: 3000,
  history: 200,
};

function plain(text: string): string {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function byArtist(artist: string): (listed: Listed) => boolean {
  const wanted = plain(artist);
  return (listed) => plain(listed.artist).includes(wanted) || plain(listed.title).includes(wanted);
}

export async function listTracks(
  list: TrackList,
  from: number,
  count: number,
  artist?: string,
): Promise<Listed[]> {
  if (!artist || plain(artist) === '') return listedRange(list, from, count);
  const all = await listedRange(list, 1, SCANNED[list]);
  return all.filter(byArtist(artist)).slice(from - 1, from - 1 + count);
}

async function listedRange(list: TrackList, from: number, count: number): Promise<Listed[]> {
  if (list === 'history') {
    const rows = await history(from, count);
    return rows.map((row, at) => ({
      n: from + at,
      title: row.title,
      artist: row.artistName,
      id: row.trackUrn,
    }));
  }
  const tracks = await tracksUpTo(list, from - 1 + count);
  return tracks.slice(from - 1, from - 1 + count).map((track, at) => listedTrack(track, from + at));
}

function playQueued(at: number): boolean {
  const { queue, queueIndex, playFromQueue } = usePlayerStore.getState();
  const index = queueIndex + at;
  if (index >= queue.length) return false;
  playFromQueue(index);
  return true;
}

async function playHistory(at: number): Promise<boolean> {
  const [row] = await history(at, 1);
  if (!row) return false;
  const { tracks } = await entityQueue({
    kind: 'track',
    name: row.title,
    artist: row.artistName,
    popularity: 0,
    id: row.trackUrn,
  });
  if (!tracks[0]) return false;
  usePlayerStore.getState().play(tracks[0], tracks);
  return true;
}

export async function playListed(list: TrackList, at: number): Promise<boolean> {
  if (at < 1) return false;
  if (list === 'queue') return playQueued(at);
  if (list === 'history') return playHistory(at);
  const tracks = await tracksUpTo(list, at);
  const track = tracks[at - 1];
  if (!track) return false;
  usePlayerStore.getState().play(track, tracks);
  if (list === 'likes') await armLikesContinuation();
  else armSuperlikesContinuation();
  return true;
}
