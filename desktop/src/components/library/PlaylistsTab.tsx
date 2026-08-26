import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteScroll, useMyLikedPlaylists, useMyPlaylists } from '../../lib/hooks';
import { Loader2 } from '../../lib/icons';
import { PlaylistCard } from '../music/PlaylistCard';
import { VirtualGrid } from '../ui/VirtualGrid';
import { useBoundedFilterPages } from './useBoundedFilterPages';

export const PlaylistsTab = React.memo(function PlaylistsTab({ filter }: { filter: string }) {
  const { t } = useTranslation();
  const myPlaylistsQuery = useMyPlaylists();
  const likedPlaylistsQuery = useMyLikedPlaylists();
  const createdPlaylists = myPlaylistsQuery.playlists;
  const likedPlaylists = likedPlaylistsQuery.playlists;

  const filteredCreated = useMemo(() => {
    if (!filter) return createdPlaylists;
    const q = filter.toLowerCase();
    return createdPlaylists.filter((p) => p.title.toLowerCase().includes(q));
  }, [createdPlaylists, filter]);

  const filteredLiked = useMemo(() => {
    if (!filter) return likedPlaylists;
    const q = filter.toLowerCase();
    return likedPlaylists.filter((p) => p.title.toLowerCase().includes(q));
  }, [likedPlaylists, filter]);

  const hasNextPage = likedPlaylistsQuery.hasNextPage || myPlaylistsQuery.hasNextPage;
  const isFetchingNextPage =
    likedPlaylistsQuery.isFetchingNextPage || myPlaylistsQuery.isFetchingNextPage;
  const fetchNextPage = likedPlaylistsQuery.hasNextPage
    ? likedPlaylistsQuery.fetchNextPage
    : myPlaylistsQuery.fetchNextPage;
  const sentinelRef = useInfiniteScroll(!!hasNextPage, !!isFetchingNextPage, fetchNextPage);
  // This tab has two independent collections. One bounded page from each keeps
  // the whole filter generation at no more than two automatic requests.
  const isFilteringCreated = useBoundedFilterPages(
    filter,
    filteredCreated.length,
    myPlaylistsQuery.hasNextPage,
    myPlaylistsQuery.isLoading,
    myPlaylistsQuery.isFetchingNextPage,
    myPlaylistsQuery.fetchNextPage,
    1,
  );
  const isFilteringLiked = useBoundedFilterPages(
    filter,
    filteredLiked.length,
    likedPlaylistsQuery.hasNextPage,
    likedPlaylistsQuery.isLoading,
    likedPlaylistsQuery.isFetchingNextPage,
    likedPlaylistsQuery.fetchNextPage,
    1,
  );
  const isFilteringMore = isFilteringCreated || isFilteringLiked;

  return (
    <div className="min-h-[400px]">
      <div className="space-y-10">
        {myPlaylistsQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-white/20" />
          </div>
        ) : filteredCreated.length > 0 ? (
          <section>
            <h3 className="text-lg font-bold text-white/80 mb-5 px-1">
              {t('library.yourPlaylists')}
            </h3>
            <VirtualGrid
              items={filteredCreated}
              itemHeight={260}
              minColumnWidth={160}
              gap={16}
              overscan={3}
              disabled={filteredCreated.length < 30}
              getItemKey={(playlist) => playlist.urn}
              renderItem={(playlist) => (
                <PlaylistCard playlist={playlist} className="sonveil-flat-media-card" />
              )}
            />
          </section>
        ) : null}

        {likedPlaylistsQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-white/20" />
          </div>
        ) : filteredLiked.length > 0 ? (
          <section>
            <h3 className="text-lg font-bold text-white/80 mb-5 px-1">
              {t('library.likedPlaylists')}
            </h3>
            <VirtualGrid
              items={filteredLiked}
              itemHeight={260}
              minColumnWidth={160}
              gap={16}
              overscan={3}
              disabled={filteredLiked.length < 30}
              getItemKey={(playlist) => playlist.urn}
              renderItem={(playlist) => (
                <PlaylistCard playlist={playlist} className="sonveil-flat-media-card" />
              )}
            />
          </section>
        ) : null}

        {!myPlaylistsQuery.isLoading &&
          !likedPlaylistsQuery.isLoading &&
          filteredCreated.length === 0 &&
          filteredLiked.length === 0 &&
          !isFilteringMore && (
            <div className="py-20 text-center text-white/20">
              {filter
                ? t(hasNextPage ? 'library.noMatchesLoaded' : 'library.noMatches')
                : t('library.noPlaylists')}
            </div>
          )}
      </div>
      {!filter && (
        <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
          {isFetchingNextPage && <Loader2 size={20} className="text-white/15 animate-spin" />}
        </div>
      )}
      {filter && isFilteringMore && (
        <div className="h-12 flex items-center justify-center mt-4">
          <Loader2 size={20} className="text-white/15 animate-spin" />
        </div>
      )}
    </div>
  );
});
