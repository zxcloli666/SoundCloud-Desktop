import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/http.ts';
import { extractPagination, type PageParam } from './pagination.ts';
import type { Comment, CommentListResponse, TrackListResponse, UserListResponse } from './types.ts';

export type { Comment } from './types.ts';

export function useTrackComments(trackUrn: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: ['track', trackUrn, 'comments'],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) {
        for (const [key, val] of Object.entries(pageParam)) {
          params.set(key, val);
        }
      }
      return api<CommentListResponse>(
        `/tracks/${encodeURIComponent(trackUrn!)}/comments?${params}`,
      );
    },
    initialPageParam: undefined as PageParam | undefined,
    getNextPageParam: (last, _all, lastPageParam) => {
      const next = extractPagination(last.next_href);
      if (!next) return undefined;
      if (lastPageParam && JSON.stringify(next) === JSON.stringify(lastPageParam)) return undefined;
      return next;
    },
    enabled: !!trackUrn,
    refetchOnMount: 'always',
  });

  const comments: Comment[] = [];
  if (query.data) {
    for (const page of query.data.pages) {
      for (const c of page.collection) comments.push(c);
    }
  }

  return { comments, ...query };
}

export function usePostComment(trackUrn: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, timestamp }: { body: string; timestamp?: number }) => {
      return api<Comment>(`/tracks/${encodeURIComponent(trackUrn!)}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          comment: { body, timestamp: timestamp ?? 0 },
        }),
      });
    },
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['track', trackUrn, 'comments'] });
      qc.refetchQueries({ queryKey: ['track', trackUrn], exact: true });
    },
  });
}

export function useRelatedTracks(trackUrn: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['track', trackUrn, 'related', limit],
    queryFn: () =>
      api<TrackListResponse>(`/tracks/${encodeURIComponent(trackUrn!)}/related?limit=${limit}`),
    enabled: !!trackUrn,
    refetchOnMount: 'always',
  });
}

export function useTrackFavoriters(trackUrn: string | undefined, limit = 12) {
  return useQuery({
    queryKey: ['track', trackUrn, 'favoriters', limit],
    queryFn: () =>
      api<UserListResponse>(`/tracks/${encodeURIComponent(trackUrn!)}/favoriters?limit=${limit}`),
    enabled: !!trackUrn,
    refetchOnMount: 'always',
  });
}
