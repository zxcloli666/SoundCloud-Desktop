import { useCallback, useMemo, useRef, useState } from 'react';
import { type SearchWave, searchWave } from '../../lib/moments/search-wave';
import { useSearchTracks } from '../../lib/search';
import type { Track } from '../../stores/player';
import type { SearchMode } from '../../stores/searchPrefs';
import type { FeedStatus, MomentsSource } from './use-moments-feed';

const WAVE_TRIES = 3;

interface Continuation {
  key: string;
  next: SearchWave;
  tracks: Track[];
  busy: boolean;
}

export interface SearchSource extends MomentsSource {
  found: Track[];
  continuing: boolean;
  continueAsWave: () => void;
}

export function useSearchSource(mode: SearchMode, q: string, fromUrn: string | null): SearchSource {
  const results = useSearchTracks(mode, q);
  const key = `${mode}:${q}`;
  const settled = results.items.length > 0 || !results.isLoading;
  const heldRef = useRef({ key, items: results.items });
  if (settled) heldRef.current = { key, items: results.items };
  const held = heldRef.current;
  const switching = held.key !== key;

  const [wave, setWave] = useState<Continuation | null>(null);
  const continuation = wave?.key === held.key ? wave : null;
  const waveRef = useRef(continuation);
  waveRef.current = continuation;

  const tracks = useMemo(
    () => (continuation ? [...held.items, ...continuation.tracks] : held.items),
    [held.items, continuation],
  );
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const pull = useCallback(async (from: Continuation) => {
    setWave({ ...from, busy: true });
    const known = new Set(tracksRef.current.map((t) => t.urn));
    let fresh: Track[] = [];
    for (let i = 0; i < WAVE_TRIES && fresh.length === 0; i++) {
      const batch = await from.next();
      if (batch.length === 0) break;
      fresh = batch.filter((t) => !known.has(t.urn));
    }
    setWave((now) => {
      if (now?.key !== from.key) return now;
      if (now.tracks.length === 0 && fresh.length === 0) return null;
      return { ...now, tracks: [...now.tracks, ...fresh], busy: fresh.length === 0 };
    });
  }, []);

  const continueAsWave = useCallback(() => {
    if (waveRef.current) return;
    const { key, items } = heldRef.current;
    void pull({ key, next: searchWave(items), tracks: [], busy: true });
  }, [pull]);

  const { hasMore, isFetchingMore, loadMore } = results;
  const more = useCallback(() => {
    const now = waveRef.current;
    if (now) {
      if (!now.busy) void pull(now);
      return;
    }
    if (hasMore && !isFetchingMore) loadMore();
  }, [pull, hasMore, isFetchingMore, loadMore]);

  const status: FeedStatus =
    tracks.length > 0 ? 'ready' : results.isLoading || switching ? 'loading' : 'empty';
  const start = Math.max(
    0,
    held.items.findIndex((t) => t.urn === fromUrn),
  );
  const tail =
    status === 'ready' && !switching && !hasMore && (continuation?.tracks.length ?? 0) === 0;

  return {
    key: held.key,
    tracks,
    status,
    start,
    tail,
    more,
    reload: loadMore,
    found: held.items,
    continuing: !!continuation?.busy,
    continueAsWave,
  };
}
