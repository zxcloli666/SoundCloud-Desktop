import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlbumsCatalog } from '../components/discover/AlbumsCatalog';
import { ArtistsCatalog } from '../components/discover/ArtistsCatalog';
import { DiscoverHero } from '../components/discover/DiscoverHero';
import { DiscoverPrism } from '../components/discover/DiscoverPrism';
import { DiscoverSpotlight } from '../components/discover/DiscoverSpotlight';
import { FeaturedHero } from '../components/discover/FeaturedHero';
import { useDebouncedValue } from '../components/discover/useDebouncedValue';
import { type TabDescriptor, TabDock } from '../components/user/TabDock';
import { fetchDiscoverRandom, useDiscoverSummary } from '../lib/discover';
import { Search, X } from '../lib/icons';

type DiscoverTabId = 'albums' | 'artists';

const SEARCH_DEBOUNCE_MS = 220;

export const Discover = memo(function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<DiscoverTabId>('albums');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [isSurprising, setIsSurprising] = useState(false);

  const summaryQuery = useDiscoverSummary();
  const summary = summaryQuery.data;

  const tabs = useMemo<ReadonlyArray<TabDescriptor<DiscoverTabId>>>(
    () => [
      { id: 'albums', label: t('discover.tabAlbums'), count: summary?.albums_count },
      { id: 'artists', label: t('discover.tabArtists'), count: summary?.artists_count },
    ],
    [t, summary?.albums_count, summary?.artists_count],
  );

  const onSurprise = useCallback(async () => {
    if (isSurprising) return;
    setIsSurprising(true);
    try {
      const kind = tab === 'albums' ? 'album' : 'artist';
      const id = await fetchDiscoverRandom(kind);
      if (id) {
        const path = kind === 'album' ? '/album/' : '/artist/';
        navigate(`${path}${encodeURIComponent(id)}`);
      }
    } finally {
      setIsSurprising(false);
    }
  }, [isSurprising, navigate, tab]);

  return (
    <div data-ui="page" data-page="discover" className="relative min-h-screen w-full">
      <div className="@container relative mx-auto flex w-full max-w-[1480px] flex-col gap-10 px-4 pt-6 pb-32 md:px-8 md:pt-8">
        <DiscoverHero
          artistsCount={summary?.artists_count ?? null}
          albumsCount={summary?.albums_count ?? null}
          freshCount={summary?.fresh_count ?? null}
          isLoading={summaryQuery.isLoading}
          onSurpriseMe={onSurprise}
          isSurprising={isSurprising}
        />
        <FeaturedHero />
        <DiscoverSpotlight />
        <DiscoverPrism />

        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <TabDock<DiscoverTabId> tabs={tabs} active={tab} onChange={setTab} />
            <SearchInput value={query} onChange={setQuery} />
          </div>
          {tab === 'albums' ? (
            <AlbumsCatalog query={debouncedQuery} />
          ) : (
            <ArtistsCatalog query={debouncedQuery} />
          )}
        </section>
      </div>
    </div>
  );
});

const SearchInput = memo(function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative w-full max-w-[300px]">
      <Search
        size={15}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-30"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('discover.searchPlaceholder')}
        className="w-full rounded-xl border border-ink/[0.06] bg-ink/[0.04] py-2.5 pr-8 pl-9 text-[13px] text-ink-80 outline-none transition-colors duration-200 placeholder:text-ink-30 hover:bg-ink/[0.06] focus:border-ink/[0.14] focus:bg-ink/[0.07]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('search.clear')}
          className="absolute inset-y-0 right-2 flex cursor-pointer items-center text-ink-30 transition-colors hover:text-ink-70"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
});
