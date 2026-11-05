import { useSyncExternalStore } from 'react';
import type { Track } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { api } from './api';
import { isTrackBlocked } from './blocked-artists';
import { isUrnDisliked } from './dislikes';
import { type PagedResponse, pagedUrl } from './hooks';
import { isKnownNonPremium } from './subscription';
import { foldName, getTrackDisplay, stripNoiseTags } from './track-display';

const PREVIEW_MS = 30_000;
const DURATION_SLACK_MS = 3_000;
const SEARCH_LIMIT = 20;
const SEARCH_TIMEOUT_MS = 8_000;
const FAILED_SEARCH_PAUSE_MS = 60_000;
const JOINERS = ['feat', 'ft', 'x', 'and', 'with', 'vs', 'the'];

const altByOriginal = new Map<string, Track | null>();
const searches = new Map<string, Promise<Track | null>>();
const listeners = new Set<() => void>();
let playing: { original: string; copy: Track } | null = null;

function lengthOf(track: Track): number {
  return track.full_duration ?? track.duration;
}

function isLocked(track: Track): boolean {
  return (
    track.access === 'preview' ||
    track.access === 'blocked' ||
    track.policy === 'SNIP' ||
    track.policy === 'BLOCK'
  );
}

function isUsable(track: Track): boolean {
  return !isLocked(track) && !isUrnDisliked(track.urn) && !isTrackBlocked(track);
}

export function wantsAltUpload(track: Track): boolean {
  const known = altByOriginal.get(track.urn);
  return (
    useSettingsStore.getState().playAltUploads &&
    isLocked(track) &&
    track._scd_meta?.storage_state !== 'ok' &&
    lengthOf(track) > PREVIEW_MS &&
    known !== null &&
    (known === undefined || isUsable(known)) &&
    isKnownNonPremium()
  );
}

function isSameSong(candidate: Track, title: string, credited: Set<string>, artist: string) {
  const name = ` ${foldName(stripNoiseTags(candidate.title))} `;
  const at = name.indexOf(` ${title} `);
  if (at < 0) return false;
  const rest = `${name.slice(0, at)} ${name.slice(at + title.length + 2)}`.split(' ');
  if (!rest.every((word) => !word || credited.has(word))) return false;
  const byline = foldName(
    `${name} ${candidate.user?.username ?? ''} ${candidate.enrichment?.primary_artist?.name ?? ''}`,
  );
  return ` ${byline} `.includes(` ${artist} `);
}

export function findAltUpload(track: Track): Promise<Track | null> {
  const known = altByOriginal.get(track.urn);
  if (known !== undefined) return Promise.resolve(known);
  const running =
    searches.get(track.urn) ?? searchAltUpload(track).finally(() => searches.delete(track.urn));
  searches.set(track.urn, running);
  return running;
}

async function searchAltUpload(track: Track): Promise<Track | null> {
  const display = getTrackDisplay(track);
  const artistName = display.artistNames[0] ?? track.user?.username ?? '';
  const title = foldName(display.title);
  const artist = foldName(artistName);
  if (!title || !artist) {
    altByOriginal.set(track.urn, null);
    return null;
  }

  const query = `q=${encodeURIComponent(`${artistName} ${display.title}`)}`;
  let page: PagedResponse<Track>;
  try {
    page = await api<PagedResponse<Track>>(
      pagedUrl('/tracks', 0, SEARCH_LIMIT, query),
      { quiet: true },
      SEARCH_TIMEOUT_MS,
    );
  } catch {
    altByOriginal.set(track.urn, null);
    setTimeout(() => altByOriginal.delete(track.urn), FAILED_SEARCH_PAUSE_MS);
    return null;
  }

  const credited = new Set([
    ...JOINERS,
    ...display.artistNames.flatMap((name) => foldName(name).split(' ')),
  ]);
  const gap = (candidate: Track) => Math.abs(lengthOf(candidate) - lengthOf(track));
  const best =
    (page.collection ?? [])
      .filter(
        (candidate) =>
          candidate.urn !== track.urn &&
          isUsable(candidate) &&
          gap(candidate) <= DURATION_SLACK_MS &&
          isSameSong(candidate, title, credited, artist),
      )
      .sort((a, b) => gap(a) - gap(b) || (b.playback_count ?? 0) - (a.playback_count ?? 0))[0] ??
    null;
  altByOriginal.set(track.urn, best);
  return best;
}

export function knownAltUpload(original: Track): Track | null {
  return altByOriginal.get(original.urn) ?? null;
}

export function dropAltUpload(original: Track): void {
  altByOriginal.set(original.urn, null);
}

export function setPlayingCopy(original: string, copy: Track | null): void {
  playing = copy && { original, copy };
  for (const listener of listeners) listener();
}

export function playingCopyOf(urn: string): Track | null {
  return playing?.original === urn ? playing.copy : null;
}

export function usePlayingCopy(urn: string): Track | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => playingCopyOf(urn),
  );
}
