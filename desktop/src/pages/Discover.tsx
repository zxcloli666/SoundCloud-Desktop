import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlbumsCatalog } from '../components/discover/AlbumsCatalog';
import { ArtistsCatalog } from '../components/discover/ArtistsCatalog';
import { DiscoverHero } from '../components/discover/DiscoverHero';
import {DiscoverPrism} from '../components/discover/DiscoverPrism';
import { DiscoverSpotlight } from '../components/discover/DiscoverSpotlight';
import {FeaturedHero} from '../components/discover/FeaturedHero';
import { useDebouncedValue } from '../components/discover/useDebouncedValue';
import { AuraField } from '../components/user/AuraField';
import { USER_PAGE_KEYFRAMES } from '../components/user/keyframes';
import { type TabDescriptor, TabDock } from '../components/user/TabDock';
import { fetchDiscoverRandom, useDiscoverSummary } from '../lib/discover';
import { Search, X } from '../lib/icons';
import {usePerfMode} from '../lib/perf';
import {useViewerAura} from '../lib/useViewerAura';

type DiscoverTabId = 'albums' | 'artists';

const SEARCH_DEBOUNCE_MS = 220;

export const Discover = memo(function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<DiscoverTabId>('albums');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [isSurprising, setIsSurprising] = useState(false);
    const perf = usePerfMode();
    const catalogBlur = perf.blur(28);

    const aura = useViewerAura();

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
    <>
      <style>{USER_PAGE_KEYFRAMES}</style>
      <div data-ui="page" data-page="discover" className="relative w-full min-h-screen">
        <AuraField aura={aura} isStar={false} />

        <div
          className="relative z-10 w-full max-w-[1480px] mx-auto px-4 md:px-8 pt-10 md:pt-16 pb-32 flex flex-col gap-10"
          style={{ isolation: 'isolate' }}
        >
          <DiscoverHero
            aura={aura}
            artistsCount={summary?.artists_count ?? null}
            albumsCount={summary?.albums_count ?? null}
            freshCount={summary?.fresh_count ?? null}
            isLoading={summaryQuery.isLoading}
            onSurpriseMe={onSurprise}
            isSurprising={isSurprising}
          />

            <FeaturedHero/>

          <DiscoverSpotlight aura={aura} />

            <DiscoverPrism/>

          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <TabDock<DiscoverTabId> tabs={tabs} active={tab} onChange={setTab} aura={aura} />
              <SearchInput value={query} onChange={setQuery} />
            </div>

            <div
              className="rounded-[2rem] p-3 md:p-6"
              style={{
                background:
                    catalogBlur > 0
                        ? 'linear-gradient(180deg, rgb(var(--ink) / 0.035) 0%, rgb(var(--ink) / 0.015) 100%)'
                        : 'rgb(var(--surface) / 0.85)',
                  backdropFilter:
                      catalogBlur > 0 ? `blur(${catalogBlur}px) saturate(160%)` : undefined,
                  WebkitBackdropFilter:
                      catalogBlur > 0 ? `blur(${catalogBlur}px) saturate(160%)` : undefined,
                boxShadow:
                  '0 30px 80px rgb(var(--shade) / calc(0.30 * var(--shade-alpha))), inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {tab === 'albums' ? (
                <AlbumsCatalog aura={aura} query={debouncedQuery} />
              ) : (
                <ArtistsCatalog aura={aura} query={debouncedQuery} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
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
    const perf = usePerfMode();
    const b = perf.blur(20);
  return (
    <div className="relative w-full max-w-[320px]">
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <Search size={15} className="text-ink-30" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('discover.searchPlaceholder')}
        className="w-full text-[13px] text-ink-85 placeholder:text-ink-25 py-2.5 pl-9 pr-8 rounded-2xl outline-none transition-all duration-300"
        style={{
            background: b > 0 ? 'rgb(var(--ink) / 0.04)' : 'rgb(var(--surface-hi) / 0.9)',
          border: '0.5px solid rgb(var(--ink) / 0.06)',
            backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
            WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-2 flex items-center text-ink-30 hover:text-ink-70 cursor-pointer transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
});
