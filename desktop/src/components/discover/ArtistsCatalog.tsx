import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type ArtistSort,
  flattenPages,
  reachedHardCap,
  type TagFilter,
  useDiscoverArtists,
  useDiscoverTags,
} from '../../lib/discover';
import { Users } from '../../lib/icons';
import { Skeleton } from '../ui/Skeleton';
import { SyncNotice } from '../ui/SyncNotice';
import { VirtualGrid } from '../ui/VirtualGrid';
import { ArtistGridCard } from './ArtistGridCard';
import { CatalogEmpty } from './CatalogEmpty';
import { FilterRow } from './FilterRow';
import { InfiniteSentinel } from './InfiniteSentinel';

const ARTIST_CARD_HEIGHT = 232;

function ArtistsCatalogImpl({ query }: { query: string }) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<ArtistSort>('popular');
  const [tag, setTag] = useState<TagFilter>('all');

  const tagsQuery = useDiscoverTags(8);
  const artistsQuery = useDiscoverArtists({ sort, tag, q: query });
  const items = useMemo(() => flattenPages(artistsQuery.data), [artistsQuery.data]);
  const cappedMore = useMemo(() => reachedHardCap(artistsQuery.data), [artistsQuery.data]);

  const loadMore = useCallback(() => {
    if (!artistsQuery.isFetchingNextPage && artistsQuery.hasNextPage) {
      artistsQuery.fetchNextPage();
    }
  }, [artistsQuery]);

  const tagOptions = useMemo<ReadonlyArray<{ id: TagFilter; label: string; count?: number }>>(
    () => [
      { id: 'all', label: t('discover.allTags') },
      ...(tagsQuery.data?.items ?? []).map((tg) => ({
        id: tg.id,
        label: tg.label,
        count: tg.count,
      })),
    ],
    [t, tagsQuery.data],
  );

  const sortOptions = useMemo<ReadonlyArray<{ id: ArtistSort; label: string }>>(
    () => [
      { id: 'popular', label: t('discover.sortPopular') },
      { id: 'trending', label: t('discover.sortTrending') },
      { id: 'listeners', label: t('discover.sortListeners') },
      { id: 'tracks', label: t('discover.sortTracks') },
      { id: 'star', label: t('discover.sortStar') },
      { id: 'az', label: t('discover.sortAz') },
    ],
    [t],
  );

  const isInitialLoading = artistsQuery.isLoading;
  const isFailed = artistsQuery.isError && items.length === 0;
  const isEmpty = !isInitialLoading && !isFailed && items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <FilterRow options={sortOptions} active={sort} onChange={setSort} />
        <FilterRow options={tagOptions} active={tag} onChange={setTag} wrap />
      </div>

      {isInitialLoading ? (
        <SkeletonGrid />
      ) : isFailed ? (
        <div className="py-24">
          <SyncNotice kind="failed" onRetry={() => void artistsQuery.refetch()} />
        </div>
      ) : isEmpty ? (
        <EmptyArtists query={query} />
      ) : (
        <VirtualGrid
          items={items}
          itemHeight={ARTIST_CARD_HEIGHT}
          minColumnWidth={200}
          gap={12}
          overscan={3}
          getItemKey={(a) => a.id}
          renderItem={(a) => <ArtistGridCard artist={a} />}
        />
      )}

      <InfiniteSentinel
        hasMore={Boolean(artistsQuery.hasNextPage)}
        isFetching={artistsQuery.isFetchingNextPage}
        onLoadMore={loadMore}
      />
      {artistsQuery.isFetchingNextPage && (
        <div className="py-4 flex justify-center">
          <Skeleton className="h-3 w-24 rounded-full" />
        </div>
      )}
      {cappedMore && !artistsQuery.isFetchingNextPage && <RefineHint />}
    </div>
  );
}

const RefineHint = memo(function RefineHint() {
  const { t } = useTranslation();
  return (
    <div className="pt-2 pb-4 flex justify-center">
      <span className="text-[11px] font-medium text-ink-35 text-center max-w-[420px] leading-relaxed">
        {t('discover.capArtists')}
      </span>
    </div>
  );
});

const SkeletonGrid = memo(function SkeletonGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col items-center pt-4"
          style={{ height: ARTIST_CARD_HEIGHT }}
        >
          <Skeleton className="h-[92px] w-[92px] rounded-full" />
          <Skeleton className="mt-4 h-3 w-24 rounded-full" />
          <Skeleton className="mt-2 h-2.5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
});

const EmptyArtists = memo(function EmptyArtists({ query }: { query: string }) {
  const { t } = useTranslation();
  return (
    <CatalogEmpty
      icon={<Users size={22} />}
      text={query ? t('discover.noMatches', { query }) : t('discover.noArtists')}
    />
  );
});

export const ArtistsCatalog = memo(ArtistsCatalogImpl);
