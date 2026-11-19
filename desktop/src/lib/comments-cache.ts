import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Track } from '../stores/player';
import type { Comment, PagedResponse } from './hooks';

export function dropCommentFromCache(qc: QueryClient, trackUrn: string, commentUrn: string) {
  qc.setQueriesData<InfiniteData<PagedResponse<Comment>, number>>(
    { queryKey: ['track', trackUrn, 'comments'] },
    (old) =>
      old && {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          collection: page.collection.filter((comment) => comment.urn !== commentUrn),
        })),
      },
  );
  qc.setQueryData<Track>(
    ['track', trackUrn],
    (old) => old && { ...old, comment_count: Math.max(0, (old.comment_count ?? 0) - 1) },
  );
}
