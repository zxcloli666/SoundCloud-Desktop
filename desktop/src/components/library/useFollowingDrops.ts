import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import { scDateMs } from '../../lib/formatters';
import { type PagedResponse, useMyFollowings } from '../../lib/hooks';
import type { Track } from '../../stores/player';

const MAX_ARTISTS = 12;
const PER_ARTIST = 6;
const FEED_SIZE = 24;
const FETCH_CONCURRENCY = 4;
const STALE_MS = 5 * 60_000;
// Keep the fanned-out track sets cached well past stale so revisiting the hub
// doesn't re-fire the artist fan-out (each can trigger a cold SC re-sync on the backend).
const GC_MS = 30 * 60_000;

export interface FollowingDrops {
  /** Newest uploads across the people you follow, deduped, newest first. */
  tracks: Track[];
  isLoading: boolean;
  isFetching: boolean;
  hasFollowings: boolean;
  refetch: () => void;
}

/** SC's own `/me/followings/tracks` aggregate returns empty for us, so we build
 *  the feed ourselves: take the people you follow and merge their recent uploads
 *  (the same TTL-refreshed source artist pages use), newest first. */
export function useFollowingDrops(): FollowingDrops {
  const qc = useQueryClient();
  const { users, isLoading: followingsLoading } = useMyFollowings();
  const targets = useMemo(() => users.slice(0, MAX_ARTISTS), [users]);

  const targetKey = useMemo(() => targets.map((target) => target.urn), [targets]);
  const combined = useQuery({
    queryKey: ['following-recent', targetKey, PER_ARTIST],
    enabled: targets.length > 0,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    queryFn: async ({ signal }) => {
      const pages: Array<PagedResponse<Track> | null> = new Array(targets.length).fill(null);
      let cursor = 0;
      const worker = async () => {
        while (cursor < targets.length) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          const index = cursor++;
          try {
            pages[index] = await api<PagedResponse<Track>>(
              `/users/${encodeURIComponent(targets[index].urn)}/tracks?limit=${PER_ARTIST}&page=0`,
              { signal },
            );
          } catch (error) {
            if (signal.aborted) throw error;
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(FETCH_CONCURRENCY, targets.length) }, () => worker()),
      );

      const seen = new Set<string>();
      const merged: Track[] = [];
      for (const page of pages) {
        for (const track of page?.collection ?? []) {
          if (seen.has(track.urn)) continue;
          seen.add(track.urn);
          merged.push(track);
        }
      }
      merged.sort(
        (a, b) =>
          scDateMs(b.created_at || b.release_date) - scDateMs(a.created_at || a.release_date),
      );
      return merged.slice(0, FEED_SIZE);
    },
  });

  const refetch = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['following-recent'] });
  }, [qc]);

  return {
    tracks: combined.data ?? [],
    isLoading: followingsLoading || combined.isLoading,
    isFetching: combined.isFetching,
    hasFollowings: users.length > 0,
    refetch,
  };
}
