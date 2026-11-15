import { useCallback, useEffect, useRef, useState } from 'react';
import { playAt } from '../../lib/audio';
import { recordEvent } from '../../lib/events';
import { trackMoment } from '../../lib/moment';
import {
  AUTO_CROSSFADE_MS,
  handOffMoment,
  momentShare,
  openMoments,
  pauseMoment,
  playMoment,
  prefetchMoment,
  SWIPE_CROSSFADE_MS,
  toggleMoment,
} from '../../lib/moments/channel';
import { fetchMoments, type MomentsBatch, takeTeaser } from '../../lib/moments/teaser';
import {
  followWave,
  LATE_SKIP_SHARE,
  noteWaveOutcome,
  sendWaveFeedback,
  type WaveTally,
} from '../../lib/wave-feedback';
import type { Track } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';

export type FeedStatus = 'loading' | 'ready' | 'empty';
type Move = 'swipe' | 'end' | 'quiet';

const BATCH = 8;
const REFILL_AT = 3;
const PREFETCH = 2;
const FAILED_SKIP_MS = 1200;

export function useMomentsFeed(startUrn?: string) {
  const languages = useSettingsStore((s) => s.soundwaveLanguages);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const langKey = [...languages].sort().join(',');

  const [tracks, setTracks] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [epoch, setEpoch] = useState(0);

  const startRef = useRef(startUrn);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const indexRef = useRef(index);
  indexRef.current = index;
  const sessionRef = useRef(0);
  const cursorRef = useRef('');
  const seenRef = useRef(new Set<string>());
  const fetchingRef = useRef(false);
  const exhaustedRef = useRef(false);
  const feedbackRef = useRef<Promise<void>>(Promise.resolve());
  const moveRef = useRef<Move>('swipe');
  const tallyRef = useRef<WaveTally>({
    owned: new Set(),
    decided: new Map(),
    negatives: 0,
    positives: 0,
  });
  const filterRef = useRef({ languages, hideListened });
  filterRef.current = { languages, hideListened };

  useEffect(() => followWave(tallyRef.current), []);

  const flushFeedback = useCallback(() => {
    const tally = tallyRef.current;
    if (tally.negatives === 0 && tally.positives === 0) return;
    feedbackRef.current = feedbackRef.current.then(async () => {
      const next = await sendWaveFeedback(cursorRef.current, tally);
      if (next) cursorRef.current = next;
    });
  }, []);

  const loadMore = useCallback(async (seed?: MomentsBatch | null) => {
    if (fetchingRef.current || exhaustedRef.current) return;
    const session = sessionRef.current;
    fetchingRef.current = true;
    try {
      await feedbackRef.current;
      const batch =
        seed ??
        (await fetchMoments({
          cursor: cursorRef.current || undefined,
          limit: BATCH,
          languages: filterRef.current.languages,
          hideListened: filterRef.current.hideListened,
        }));
      if (session !== sessionRef.current) return;
      if (batch.cursor) cursorRef.current = batch.cursor;
      const fresh = leadWith(
        batch.tracks.filter((t) => !seenRef.current.has(t.urn)),
        seed ? startRef.current : undefined,
      );
      for (const t of fresh) {
        seenRef.current.add(t.urn);
        tallyRef.current.owned.add(t.urn);
      }
      if (fresh.length === 0) exhaustedRef.current = true;
      if (fresh.length > 0) setTracks((prev) => [...prev, ...fresh]);
      setStatus(fresh.length > 0 || tracksRef.current.length > 0 ? 'ready' : 'empty');
    } finally {
      if (session === sessionRef.current) fetchingRef.current = false;
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: langKey, hideListened and epoch restart the feed.
  useEffect(() => {
    sessionRef.current += 1;
    cursorRef.current = '';
    seenRef.current = new Set();
    fetchingRef.current = false;
    exhaustedRef.current = false;
    tallyRef.current.owned.clear();
    tallyRef.current.decided.clear();
    tallyRef.current.negatives = 0;
    tallyRef.current.positives = 0;
    setTracks([]);
    setIndex(0);
    setStatus('loading');
    void loadMore(takeTeaser(filterRef.current.languages, filterRef.current.hideListened));
  }, [langKey, hideListened, epoch, loadMore]);

  const signalLeave = useCallback(
    (track: Track, move: Move) => {
      if (move === 'quiet') return;
      const share = momentShare(track.urn);
      if (move === 'end' || share >= LATE_SKIP_SHARE) noteWaveOutcome('full_play', track.urn, 1);
      else if (share > 0) recordEvent('skip', track.urn, share);
      flushFeedback();
    },
    [flushFeedback],
  );

  const go = useCallback(
    (delta: 1 | -1, move: Move = delta > 0 ? 'swipe' : 'quiet'): boolean => {
      const list = tracksRef.current;
      const from = indexRef.current;
      const to = from + delta;
      if (to < 0 || to >= list.length) return false;
      signalLeave(list[from], move);
      moveRef.current = move;
      setIndex(to);
      return true;
    },
    [signalLeave],
  );

  useEffect(
    () =>
      openMoments((urn) => {
        const current = tracksRef.current[indexRef.current];
        if (current?.urn === urn && !go(1, 'end')) pauseMoment();
      }),
    [go],
  );

  const current = tracks[index];
  const currentUrn = current?.urn;

  // biome-ignore lint/correctness/useExhaustiveDependencies: replays only when the card under focus changes.
  useEffect(() => {
    if (!current) return;
    let alive = true;
    const crossfade = moveRef.current === 'end' ? AUTO_CROSSFADE_MS : SWIPE_CROSSFADE_MS;
    void playMoment(current, crossfade).then((ok) => {
      if (!alive || ok) return;
      setTimeout(() => {
        if (alive && tracksRef.current[indexRef.current]?.urn === current.urn) go(1, 'quiet');
      }, FAILED_SKIP_MS);
    });
    for (const next of tracks.slice(index + 1, index + 1 + PREFETCH)) prefetchMoment(next);
    if (tracks.length - index - 1 < REFILL_AT) void loadMore();
    return () => {
      alive = false;
    };
  }, [currentUrn]);

  useEffect(() => {
    if (status === 'ready' && tracks.length - index - 1 < REFILL_AT) void loadMore();
  }, [tracks.length, index, status, loadMore]);

  const toggle = useCallback(() => {
    const track = tracksRef.current[indexRef.current];
    if (track) toggleMoment(track);
  }, []);

  const listenFull = useCallback(
    (track: Track) => {
      const moment = trackMoment(track);
      handOffMoment(track.urn);
      noteWaveOutcome('superlike', track.urn);
      flushFeedback();
      playAt(track, (moment?.startMs ?? 0) / 1000);
    },
    [flushFeedback],
  );

  const reload = useCallback(() => setEpoch((e) => e + 1), []);

  return { tracks, index, status, go, toggle, listenFull, reload };
}

function leadWith(tracks: Track[], urn: string | undefined): Track[] {
  const at = urn ? tracks.findIndex((t) => t.urn === urn) : -1;
  if (at <= 0) return tracks;
  return [tracks[at], ...tracks.slice(0, at), ...tracks.slice(at + 1)];
}
