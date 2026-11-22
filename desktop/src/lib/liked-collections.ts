import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { PagedResponse, Playlist } from './hooks';

type LikedCollections = InfiniteData<PagedResponse<Playlist>, number>;

export function patchLikedCollections(queryClient: QueryClient, item: Playlist, liked: boolean) {
  queryClient.setQueriesData<LikedCollections>(
    { queryKey: ['me', 'likes', 'playlists'] },
    (cached) => {
      if (!cached) return cached;
      return {
        ...cached,
        pages: cached.pages.map((page, index) => {
          if (index !== 0) return page;
          const withoutItem = page.collection.filter((collection) => collection.urn !== item.urn);
          return { ...page, collection: liked ? [item, ...withoutItem] : withoutItem };
        }),
      };
    },
  );
}
