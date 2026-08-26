import {memo, useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {type Aura, auraRgba} from '../../lib/aura';
import {
    type AlbumKindFilter,
    type AlbumSort,
    type CatalogAlbum,
    flattenPages,
    reachedHardCap,
    useDiscoverAlbums,
    useDiscoverAlbumsByYear,
} from '../../lib/discover';
import {Disc3} from '../../lib/icons';
import {Skeleton} from '../ui/Skeleton';
import {VirtualGrid} from '../ui/VirtualGrid';
import {AlbumGridCard} from './AlbumGridCard';
import {FilterRow} from './FilterRow';
import {InfiniteSentinel} from './InfiniteSentinel';

interface AlbumsCatalogProps {
  aura: Aura;
  query: string;
}

function AlbumsCatalogImpl({ aura, query }: AlbumsCatalogProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<AlbumKindFilter>('all');
  const [sort, setSort] = useState<AlbumSort>('recent');

  const useYearBuckets = sort === 'recent' && !query;

    const kindOptions = useMemo<ReadonlyArray<{ id: AlbumKindFilter; label: string }>>(
        () => [
            {id: 'all', label: t('discover.allKinds')},
            {id: 'album', label: t('artist.kind.album')},
            {id: 'ep', label: t('artist.kind.ep')},
            {id: 'single', label: t('artist.kind.single')},
            {id: 'compilation', label: t('artist.kind.compilation')},
        ],
        [t],
    );

    const sortOptions = useMemo<ReadonlyArray<{ id: AlbumSort; label: string }>>(
        () => [
            {id: 'recent', label: t('discover.sortRecent')},
            {id: 'popular', label: t('discover.sortPopular')},
            {id: 'tracks', label: t('discover.sortTracks')},
            {id: 'az', label: t('discover.sortAz')},
        ],
        [t],
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <FilterRow options={kindOptions} active={kind} onChange={setKind} aura={aura} />
        <FilterRow options={sortOptions} active={sort} onChange={setSort} aura={aura} size="sm" />
      </div>

      {useYearBuckets ? (
        <YearBucketsView kind={kind} aura={aura} />
      ) : (
        <FlatAlbumsView sort={sort} kind={kind} query={query} aura={aura} />
      )}
    </div>
  );
}

const YearBucketsView = memo(function YearBucketsView({
  kind,
  aura,
}: {
  kind: AlbumKindFilter;
  aura: Aura;
}) {
  const { data, isLoading } = useDiscoverAlbumsByYear({ kind, years: 8, perYear: 20 });
  const buckets = data?.buckets ?? [];

  if (isLoading) return <YearBucketsSkeleton />;
  if (buckets.length === 0) return <EmptyAlbums query="" />;

  return (
    <div className="flex flex-col gap-12">
      {buckets.map((bucket) => (
        <YearGroup key={bucket.year} year={bucket.year} items={bucket.items} aura={aura} />
      ))}
    </div>
  );
});

const FlatAlbumsView = memo(function FlatAlbumsView({
  sort,
  kind,
  query,
  aura,
}: {
  sort: AlbumSort;
  kind: AlbumKindFilter;
  query: string;
  aura: Aura;
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
  const isEmpty = !isInitialLoading && items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {isInitialLoading ? (
        <SkeletonGrid />
      ) : isEmpty ? (
        <EmptyAlbums query={query} />
      ) : (
        <VirtualGrid
          items={items}
          itemHeight={300}
          minColumnWidth={180}
          gap={20}
          overscan={3}
          disabled={items.length < 40}
          getItemKey={(a) => a.id}
          renderItem={(a) => <AlbumGridCard album={a} aura={aura} />}
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
  aura,
}: {
  year: number;
  items: CatalogAlbum[];
  aura: Aura;
}) {
  const { t } = useTranslation();
  return (
    <div className="deferred-year-group deferred-year-group--albums flex flex-col md:flex-row md:gap-8 gap-4">
      <div className="md:w-[200px] md:shrink-0 flex md:flex-col md:items-end items-center md:sticky md:top-24 self-start">
        <div className="flex items-baseline gap-3 md:flex-col md:items-end md:gap-1 min-w-0 max-w-full">
          <span
            className="font-black leading-none tabular-nums tracking-tight whitespace-nowrap text-[clamp(48px,7vw,80px)]"
            style={{
              background: `linear-gradient(180deg, ${auraRgba(aura, 0.95)}, ${auraRgba(aura, 0.4)})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: `drop-shadow(0 4px 24px ${auraRgba(aura, 0.35)})`,
            }}
          >
            {year}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 md:text-right whitespace-nowrap">
            {t('artist.releaseYear')} · {items.length}
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        {items.map((al) => (
            <AlbumGridCard key={al.id} album={al} aura={aura}/>
        ))}
      </div>
    </div>
  );
});

const RefineHint = memo(function RefineHint() {
  const { t } = useTranslation();
  return (
    <div className="pt-2 pb-4 flex justify-center">
      <span className="text-[11px] font-medium text-white/35 text-center max-w-[420px] leading-relaxed">
        {t('discover.capAlbums')}
      </span>
    </div>
  );
});

const SkeletonGrid = memo(function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="h-[300px] rounded-3xl" />
      ))}
    </div>
  );
});

const YearBucketsSkeleton = memo(function YearBucketsSkeleton() {
  return (
    <div className="flex flex-col gap-12">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col md:flex-row md:gap-8 gap-4">
          <Skeleton className="md:w-[200px] h-[64px] rounded-2xl" />
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-[300px] rounded-3xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

const EmptyAlbums = memo(function EmptyAlbums({ query }: { query: string }) {
  const { t } = useTranslation();
  return (
    <div className="py-24 flex flex-col items-center gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '0.5px solid rgba(255,255,255,0.06)',
        }}
      >
        <Disc3 size={24} className="text-white/15" />
      </div>
      <p className="text-white/30 text-sm">
        {query ? t('discover.noMatches', { query }) : t('discover.noAlbums')}
      </p>
    </div>
  );
});

export const AlbumsCatalog = memo(AlbumsCatalogImpl);
