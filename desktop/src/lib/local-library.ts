import i18n from '../i18n';
import type { Track } from '../stores/player';
import { getStaticPort } from './constants';

const LOCAL_PREFIX = 'local:tracks:';

export const LOCAL_AUDIO_EXTENSIONS = [
  'mp3',
  'm4a',
  'mp4',
  'aac',
  'flac',
  'ogg',
  'oga',
  'opus',
  'wav',
];

export interface LocalTrackInfo {
  id: string;
  path: string;
  title: string;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  durationMs: number | null;
  cover: string | null;
  bytes: number;
  modifiedAt: number;
}

export interface LocalTrack extends LocalTrackInfo {
  addedAt: number;
}

export interface LocalPlaylist {
  id: string;
  title: string;
  trackIds: string[];
  createdAt: number;
}

export function isLocalUrn(urn: string | null | undefined): boolean {
  return !!urn && urn.startsWith(LOCAL_PREFIX);
}

export function localUrn(id: string): string {
  return `${LOCAL_PREFIX}${id}`;
}

export function localIdOf(urn: string): string | null {
  return isLocalUrn(urn) ? urn.slice(LOCAL_PREFIX.length) : null;
}

export function localCoverUrl(cover: string | null): string | null {
  const port = getStaticPort();
  if (!cover || !port) return null;
  return `http://127.0.0.1:${port}/local-covers/${encodeURIComponent(cover)}`;
}

export function isLocalAudioPath(path: string): boolean {
  const dot = path.lastIndexOf('.');
  return dot > 0 && LOCAL_AUDIO_EXTENSIONS.includes(path.slice(dot + 1).toLowerCase());
}

export function localArtist(track: LocalTrackInfo): string {
  return track.artist || track.albumArtist || i18n.t('local.unknownArtist');
}

export function localTrackToTrack(track: LocalTrackInfo): Track {
  return {
    id: 0,
    urn: localUrn(track.id),
    title: track.title,
    duration: track.durationMs ?? 0,
    artwork_url: localCoverUrl(track.cover),
    genre: track.genre ?? undefined,
    release_year: track.year ?? undefined,
    access: 'playable',
    user: { id: 0, urn: '', username: localArtist(track), avatar_url: '' },
  };
}
