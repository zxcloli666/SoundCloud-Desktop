import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMoments, type MomentsBatch, takeTeaser } from '../../lib/moments/teaser';
import {
  followWave,
  noteWaveOutcome,
  sendWaveFeedback,
  type WaveTally,
} from '../../lib/wave-feedback';
import type { Track } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import type { FeedStatus, MomentsSource } from './use-moments-feed';

const BATCH = 8;

export function useWaveSource(startUrn?: string): MomentsSource {
  const languages = useSettingsStore((s) => s.soundwaveLanguages);
  const genres = useSettingsStore((s) => s.soundwaveGenres);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const langKey = [...languages].sort().join(',');
  const genreKey = [...genres].sort().join(',');

  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState<FeedStatus>('loading');
  const [round, setRound] = useState(0);
  const [epoch, setEpoch] = useState(0);

  const startRef = useRef(startUrn);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const sessionRef = useRef(0);
  const cursorRef = useRef('');
  const seenRef = useRef(new Set<string>());
  const fetchingRef = useRef(false);
  const exhaustedRef = useRef(false);
  const feedbackRef = useRef<Promise<void>>(Promise.resolve());
  const tallyRef = useRef<WaveTally>({
    owned: new Set(),
    decided: new Map(),
    negatives: 0,
    positives: 0,
  });
  const filterRef = useRef({ languages, genres, hideListened });
  filterRef.current = { languages, genres, hideListened };

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: langKey, genreKey, hideListened and epoch restart the feed.
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
    setRound((r) => r + 1);
    setStatus('loading');
    void loadMore(
      takeTeaser(
        filterRef.current.languages,
        filterRef.current.genres,
        filterRef.current.hideListened,
      ),
    );
  }, [langKey, genreKey, hideListened, epoch, loadMore]);

  const more = useCallback(() => void loadMore(), [loadMore]);
  const reload = useCallback(() => setEpoch((e) => e + 1), []);

  const onLeave = useCallback(
    (track: Track, finished: boolean) => {
      if (finished) noteWaveOutcome('full_play', track.urn, 1);
      flushFeedback();
    },
    [flushFeedback],
  );

  const onListenFull = useCallback(
    (track: Track) => {
      noteWaveOutcome('superlike', track.urn);
      flushFeedback();
    },
    [flushFeedback],
  );

  return {
    key: String(round),
    tracks,
    status,
    start: 0,
    tail: false,
    more,
    reload,
    onLeave,
    onListenFull,
  };
}

function leadWith(tracks: Track[], urn: string | undefined): Track[] {
  const at = urn ? tracks.findIndex((t) => t.urn === urn) : -1;
  if (at <= 0) return tracks;
  return [tracks[at], ...tracks.slice(0, at), ...tracks.slice(at + 1)];
}
