import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type AlbumKindFilter,
  type AlbumSort,
  type CatalogAlbum,
  flattenPages,
  reachedHardCap,
  useDiscoverAlbums,
  useDiscoverAlbumsByYear,
} from '../../lib/discover';
import { Disc3 } from '../../lib/icons';
import { Skeleton } from '../ui/Skeleton';
import { SyncNotice } from '../ui/SyncNotice';
import { VirtualGrid } from '../ui/VirtualGrid';
import { ALBUM_CARD_TEXT, AlbumGridCard } from './AlbumGridCard';
import { CatalogEmpty } from './CatalogEmpty';
import { FilterRow } from './FilterRow';
import { InfiniteSentinel } from './InfiniteSentinel';

const cardHeight = (width: number) => width + ALBUM_CARD_TEXT;

function AlbumsCatalogImpl({ query }: { query: string }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<AlbumKindFilter>('all');
  const [sort, setSort] = useState<AlbumSort>('recent');

  const useYearBuckets = sort === 'recent' && !query;

  const kindOptions = useMemo<ReadonlyArray<{ id: AlbumKindFilter; label: string }>>(
    () => [
      { id: 'all', label: t('discover.allKinds') },
      { id: 'album', label: t('artist.kind.album') },
      { id: 'ep', label: t('artist.kind.ep') },
      { id: 'single', label: t('artist.kind.single') },
      { id: 'compilation', label: t('artist.kind.compilation') },
    ],
    [t],
  );

  const sortOptions = useMemo<ReadonlyArray<{ id: AlbumSort; label: string }>>(
    () => [
      { id: 'recent', label: t('discover.sortRecent') },
      { id: 'popular', label: t('discover.sortPopular') },
      { id: 'tracks', label: t('discover.sortTracks') },
      { id: 'az', label: t('discover.sortAz') },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterRow options={kindOptions} active={kind} onChange={setKind} />
        <FilterRow options={sortOptions} active={sort} onChange={setSort} />
      </div>

      {useYearBuckets ? (
        <YearBucketsView kind={kind} />
      ) : (
        <FlatAlbumsView sort={sort} kind={kind} query={query} />
      )}
    </div>
  );
}

const YearBucketsView = memo(function YearBucketsView({ kind }: { kind: AlbumKindFilter }) {
  const { data, isLoading, isError, refetch } = useDiscoverAlbumsByYear({
    kind,
    years: 8,
    perYear: 20,
  });
  const buckets = data?.buckets ?? [];

  if (isLoading) return <YearBucketsSkeleton />;
  if (isError && buckets.length === 0) {
    return (
      <div className="py-24">
        <SyncNotice kind="failed" onRetry={() => void refetch()} />
      </div>
    );
  }
  if (buckets.length === 0) return <EmptyAlbums query="" />;

  return (
    <div className="flex flex-col gap-10">
      {buckets.map((bucket) => (
        <YearGroup key={bucket.year} year={bucket.year} items={bucket.items} />
      ))}
    </div>
  );
});

const FlatAlbumsView = memo(function FlatAlbumsView({
  sort,
  kind,
  query,
}: {
  sort: AlbumSort;
  kind: AlbumKindFilter;
  query: string;
}) {
  const albumsQuery = useDiscoverAlbums({ sort, kind, q: query });
  const items = useMemo(() => flattenPages(albumsQuery.data), [albumsQuery.data]);
  const cappedMore = useMemo(() => reachedHardCap(albumsQuery.data), [albumsQuery.data]);

  const loadMore = useCallback(() => {
    if (!albumsQuery.isFetchingNextPage && albumsQuery.hasNextPage) {
      albumsQuery.fetchNextPage();
    }
  }, [albumsQuery]);

  const isInitialLoading = albumsQuery.isLoading;
  const isFailed = albumsQuery.isError && items.length === 0;
  const isEmpty = !isInitialLoading && !isFailed && items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {isInitialLoading ? (
        <SkeletonGrid />
      ) : isFailed ? (
        <div className="py-24">
          <SyncNotice kind="failed" onRetry={() => void albumsQuery.refetch()} />
        </div>
      ) : isEmpty ? (
        <EmptyAlbums query={query} />
      ) : (
        <VirtualGrid
          items={items}
          itemHeight={cardHeight}
          minColumnWidth={180}
          gap={20}
          overscan={3}
          getItemKey={(a) => a.id}
          renderItem={(a) => <AlbumGridCard album={a} />}
        />
      )}

      <InfiniteSentinel
        hasMore={Boolean(albumsQuery.hasNextPage)}
        isFetching={albumsQuery.isFetchingNextPage}
        onLoadMore={loadMore}
      />
      {albumsQuery.isFetchingNextPage && (
        <div className="py-4 flex justify-center">
          <Skeleton className="h-3 w-24 rounded-full" />
        </div>
      )}
      {cappedMore && !albumsQuery.isFetchingNextPage && <RefineHint />}
    </div>
  );
});

const YearGroup = memo(function YearGroup({
  year,
  items,
}: {
  year: number;
  items: CatalogAlbum[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="flex items-baseline gap-2.5 tabular-nums">
        <span className="text-[16px] font-bold tracking-tight text-ink-90">{year}</span>
        <span className="text-[12px] text-ink-30">{items.length}</span>
      </h3>
      <VirtualGrid
        items={items}
        itemHeight={cardHeight}
        minColumnWidth={180}
        gap={20}
        overscan={1}
        getItemKey={(album) => album.id}
        renderItem={(album) => <AlbumGridCard album={album} />}
      />
    </section>
  );
});

const RefineHint = memo(function RefineHint() {
  const { t } = useTranslation();
  return (
    <div className="pt-2 pb-4 flex justify-center">
      <span className="text-[11px] font-medium text-ink-35 text-center max-w-[420px] leading-relaxed">
        {t('discover.capAlbums')}
      </span>
    </div>
  );
});

const SkeletonCards = memo(function SkeletonCards({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <Skeleton className="mt-3 h-3 w-3/4 rounded-full" />
          <Skeleton className="mt-2 h-2.5 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
});

const SkeletonGrid = memo(function SkeletonGrid() {
  return <SkeletonCards count={10} />;
});

const YearBucketsSkeleton = memo(function YearBucketsSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4">
          <Skeleton className="h-4 w-16 rounded-full" />
          <SkeletonCards count={5} />
        </div>
      ))}
    </div>
  );
});

const EmptyAlbums = memo(function EmptyAlbums({ query }: { query: string }) {
  const { t } = useTranslation();
  return (
    <CatalogEmpty
      icon={<Disc3 size={22} />}
      text={query ? t('discover.noMatches', { query }) : t('discover.noAlbums')}
    />
  );
});

export const AlbumsCatalog = memo(AlbumsCatalogImpl);
