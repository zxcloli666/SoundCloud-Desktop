import { useCallback, useEffect, useRef, useState } from 'react';
import { playAt } from '../../lib/audio';
import { recordEvent } from '../../lib/events';
import {
  AUTO_CROSSFADE_MS,
  handOffMoment,
  momentShare,
  momentStartMs,
  openMoments,
  pauseMoment,
  playMoment,
  prefetchMoment,
  SWIPE_CROSSFADE_MS,
  stopMoments,
  toggleMoment,
} from '../../lib/moments/channel';
import { LATE_SKIP_SHARE } from '../../lib/wave-feedback';
import type { Track } from '../../stores/player';

export type FeedStatus = 'loading' | 'ready' | 'empty';
type Move = 'swipe' | 'end' | 'quiet';

export interface MomentsSource {
  key: string;
  tracks: Track[];
  status: FeedStatus;
  start: number;
  tail: boolean;
  more: () => void;
  reload: () => void;
  onLeave?: (track: Track, finished: boolean) => void;
  onListenFull?: (track: Track) => void;
}

const REFILL_AT = 3;
const PREFETCH = 2;
const FAILED_SKIP_MS = 1200;

export function useMomentsFeed(source: MomentsSource) {
  const { key, tracks, status, more } = source;
  const [at, setAt] = useState({ key, index: source.start });
  if (at.key !== key) setAt({ key, index: source.start });
  const index = at.key === key ? at.index : source.start;

  const sourceRef = useRef(source);
  sourceRef.current = source;
  const indexRef = useRef(index);
  indexRef.current = index;
  const moveRef = useRef<Move>('swipe');
  const playedKeyRef = useRef(key);

  const go = useCallback((delta: 1 | -1, move: Move = delta > 0 ? 'swipe' : 'quiet'): boolean => {
    const { key, tracks, tail } = sourceRef.current;
    const from = indexRef.current;
    const to = from + delta;
    const last = tail ? tracks.length : tracks.length - 1;
    if (to < 0 || to > last) return false;
    if (tracks[from]) signalLeave(sourceRef.current, tracks[from], move);
    moveRef.current = move;
    setAt({ key, index: to });
    return true;
  }, []);

  useEffect(
    () =>
      openMoments((urn) => {
        const current = sourceRef.current.tracks[indexRef.current];
        if (current?.urn !== urn || !go(1, 'end')) pauseMoment();
      }),
    [go],
  );

  const current = tracks[index];
  const currentUrn = current?.urn;
  const resting = !current && (status === 'empty' || index > 0);

  useEffect(() => {
    if (status !== 'ready') return;
    for (const track of tracks.slice(index, index + PREFETCH + 1)) prefetchMoment(track);
  }, [index, status, tracks]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: replays only when the card under focus changes.
  useEffect(() => {
    if (!current) return;
    let alive = true;
    const fresh = playedKeyRef.current !== key;
    playedKeyRef.current = key;
    const soft = fresh || moveRef.current === 'end';
    void playMoment(current, soft ? AUTO_CROSSFADE_MS : SWIPE_CROSSFADE_MS).then((ok) => {
      if (alive && ok) {
        for (const next of tracks.slice(index + 1, index + 1 + PREFETCH)) prefetchMoment(next);
      }
      if (!alive || ok) return;
      setTimeout(() => {
        const list = sourceRef.current.tracks;
        if (alive && list[indexRef.current]?.urn === current.urn) go(1, 'quiet');
      }, FAILED_SKIP_MS);
    });
    return () => {
      alive = false;
    };
  }, [currentUrn]);

  useEffect(() => {
    if (resting) stopMoments(AUTO_CROSSFADE_MS);
  }, [resting]);

  useEffect(() => {
    if (status === 'ready' && tracks.length - index - 1 < REFILL_AT) more();
  }, [tracks.length, index, status, more]);

  const toggle = useCallback(() => {
    const track = sourceRef.current.tracks[indexRef.current];
    if (track) toggleMoment(track);
  }, []);

  const listenFull = useCallback((track: Track) => {
    const startMs = momentStartMs(track);
    handOffMoment(track.urn);
    sourceRef.current.onListenFull?.(track);
    playAt(track, startMs / 1000);
  }, []);

  return { tracks, index, status, go, toggle, listenFull, reload: source.reload };
}

function signalLeave(source: MomentsSource, track: Track, move: Move) {
  if (move === 'quiet') return;
  const share = momentShare(track.urn);
  const finished = move === 'end' || share >= LATE_SKIP_SHARE;
  if (!finished && share > 0) recordEvent('skip', track.urn, share);
  source.onLeave?.(track, finished);
}
