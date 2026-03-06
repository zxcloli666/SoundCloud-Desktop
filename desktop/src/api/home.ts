import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../lib/http.ts';
import { extractPagination, type PageParam } from './pagination.ts';
import type { Track, TrackListResponse } from './types.ts';

export type FeedOrigin = Track & {
  track_count?: number;
  set_type?: string;
  tracks?: Track[];
};

export interface FeedItem {
  type: string;
  created_at: string;
  origin: FeedOrigin;
}

interface FeedResponse {
  collection: FeedItem[];
  next_href: string | null;
}

export function useFeed() {
  const query = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<FeedResponse>(`/me/feed?${params}`);
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) {
        return undefined;
      }
      return next;
    },
    select: (data) => {
      const items: FeedItem[] = [];
      const seen = new Set<string>();
      for (const page of data.pages) {
        for (const item of page.collection) {
          const urn = item.origin?.urn;
          if (urn && !seen.has(urn)) {
            seen.add(urn);
            items.push(item);
          }
        }
      }
      return items;
    },
  });

  return {
    items: query.data ?? [],
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
  };
}

export function useLikedTracks(limit = 10) {
  return useQuery({
    queryKey: ['me', 'likes', 'tracks', limit],
    queryFn: () => api<TrackListResponse>(`/me/likes/tracks?limit=${limit}`),
  });
}

export function useFollowingTracks(limit = 20) {
  return useQuery({
    queryKey: ['me', 'followings', 'tracks', limit],
    queryFn: () => api<TrackListResponse>(`/me/followings/tracks?limit=${limit}`),
  });
}

export function useGenreTracks(genre: string, limit = 20) {
  return useQuery({
    queryKey: ['discover', 'genre', genre, limit],
    queryFn: () =>
      api<TrackListResponse>(
        `/tracks?genres=${encodeURIComponent(genre)}&limit=${limit}&linked_partitioning=true&access=playable`,
      ),
    staleTime: 1000 * 60 * 10,
  });
}

export function useRecommendedTracks(seedTrackUrn: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['discover', 'related', seedTrackUrn, limit],
    queryFn: () =>
      api<TrackListResponse>(`/tracks/${encodeURIComponent(seedTrackUrn!)}/related?limit=${limit}`),
    enabled: !!seedTrackUrn,
    staleTime: 1000 * 60 * 10,
  });
}
