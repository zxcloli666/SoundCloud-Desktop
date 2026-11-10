import type { PlaybackQuality, Track } from '../stores/player';
import { dropAltUpload, findAltUpload } from './alt-upload';
import {
  ensureTrackCached,
  expectedDurationMs,
  getCacheInfo,
  removeCachedTrack,
  type TrackCacheInfo,
} from './cache';

export const LOAD_RACE_MS = 10_000;

const storageUrns = new Set<string>();

export interface RaceWinner {
  file: Track;
  info: TrackCacheInfo;
}

export interface RaceHooks {
  quality: PlaybackQuality;
  canRace: () => boolean;
  isCurrent: () => boolean;
  onCopy: (urn: string) => void;
  onOriginalFailed: (error: unknown) => void;
}

export function noteDownloadSource(urn: string, source: string | undefined): void {
  if (source === 'storage') storageUrns.add(urn);
}

export function forgetDownloadSource(urn: string): void {
  storageUrns.delete(urn);
}

export interface RaceHandle {
  result: Promise<RaceWinner>;
  startNow: () => boolean;
}

export function raceWithCopy(
  track: Track,
  original: Promise<TrackCacheInfo>,
  hooks: RaceHooks,
): RaceHandle {
  let startNow = () => false;
  const result = new Promise<RaceWinner>((resolve, reject) => {
    let started = false;
    let winner: Track | null = null;
    let racing = false;
    let failure: { error: unknown } | null = null;

    const finish = () => {
      clearTimeout(timer);
    };
    const win = (file: Track, info: TrackCacheInfo) => {
      if (winner) return;
      winner = file;
      finish();
      resolve({ file, info });
    };
    const lose = () => {
      if (winner || racing || !failure) return;
      winner = track;
      finish();
      reject(failure.error);
    };

    const allowed = () =>
      !winner &&
      !storageUrns.has(track.urn) &&
      track._scd_meta?.storage_state !== 'ok' &&
      hooks.canRace();

    const race = async () => {
      if (started || !allowed()) return;
      started = true;
      racing = true;
      const copy = await findAltUpload(track).catch(() => null);
      if (winner || !copy || !hooks.canRace()) {
        racing = false;
        lose();
        return;
      }
      hooks.onCopy(copy.urn);
      const existed = !!(await getCacheInfo(copy.urn).catch(() => null));
      ensureTrackCached(
        copy.urn,
        hooks.quality,
        expectedDurationMs(copy),
        copy._scd_meta?.storage_quality,
      ).then(
        (info) => {
          if (!winner && hooks.isCurrent()) win(copy, info);
          else if (!existed) removeCachedTrack(copy.urn).catch(() => {});
        },
        () => {
          dropAltUpload(track);
          racing = false;
          lose();
        },
      );
    };

    const timer = setTimeout(() => void race(), LOAD_RACE_MS);
    startNow = () => {
      if (started) return racing;
      if (!allowed()) return false;
      clearTimeout(timer);
      void race();
      return true;
    };
    original.then(
      (info) => win(track, info),
      (error) => {
        failure = { error };
        hooks.onOriginalFailed(error);
        lose();
      },
    );
  });
  return { result, startNow: () => startNow() };
}
