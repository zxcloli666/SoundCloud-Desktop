import { lazy, memo, Suspense, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlbumsCatalog } from '../components/discover/AlbumsCatalog';
import { ArtistsCatalog } from '../components/discover/ArtistsCatalog';
import { useDebouncedValue } from '../components/discover/useDebouncedValue';
import { fetchDiscoverRandom, useDiscoverSummary } from '../lib/discover';
import { Loader2, Search, Shuffle, X } from '../lib/icons';
import { useViewerAura } from '../lib/useViewerAura';

type DiscoverTabId = 'albums' | 'artists';

const SEARCH_DEBOUNCE_MS = 220;
const DiscoverPrism = lazy(() =>
  import('../components/discover/DiscoverPrism').then((module) => ({
    default: module.DiscoverPrism,
  })),
);

export const Discover = memo(function Discover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const aura = useViewerAura();
  const summaryQuery = useDiscoverSummary();
  const summary = summaryQuery.data;
  const [tab, setTab] = useState<DiscoverTabId>('albums');
  const [query, setQuery] = useState('');
  const [isSurprising, setIsSurprising] = useState(false);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const onSurprise = useCallback(async () => {
    if (isSurprising) return;
    setIsSurprising(true);
    try {
      const kind = tab === 'albums' ? 'album' : 'artist';
      const id = await fetchDiscoverRandom(kind);
      if (id) navigate(`/${kind}/${encodeURIComponent(id)}`);
    } finally {
      setIsSurprising(false);
    }
  }, [isSurprising, navigate, tab]);

  return (
    <div className="sonveil-section-page">
      <div className="sonveil-discover-content">
        <header className="sonveil-page-header">
          <div>
            <h1>{t('discover.title')}</h1>
            {summary ? (
              <p>
                {t('discover.metaAlbums', { count: summary.albums_count })} ·{' '}
                {t('discover.metaArtists', { count: summary.artists_count })}
              </p>
            ) : null}
          </div>
          <button type="button" className="sonveil-secondary-action" onClick={onSurprise}>
            {isSurprising ? <Loader2 size={15} className="animate-spin" /> : <Shuffle size={15} />}
            {t('discover.surpriseMe')}
          </button>
        </header>

        {!query.trim() ? (
          <Suspense fallback={<div className="min-h-24" aria-hidden="true" />}>
            <DiscoverPrism />
          </Suspense>
        ) : null}

        <div className="sonveil-page-toolbar">
          <nav className="sonveil-page-tabs" aria-label={t('discover.title')}>
            <button
              type="button"
              className={tab === 'albums' ? 'is-active' : undefined}
              onClick={() => setTab('albums')}
            >
              {t('discover.tabAlbums')}
            </button>
            <button
              type="button"
              className={tab === 'artists' ? 'is-active' : undefined}
              onClick={() => setTab('artists')}
            >
              {t('discover.tabArtists')}
            </button>
          </nav>
          <DiscoverSearch value={query} onChange={setQuery} />
        </div>

        <section className="sonveil-catalog-surface">
          {tab === 'albums' ? (
            <AlbumsCatalog aura={aura} query={debouncedQuery} />
          ) : (
            <ArtistsCatalog aura={aura} query={debouncedQuery} />
          )}
        </section>
      </div>
    </div>
  );
});

const DiscoverSearch = memo(function DiscoverSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="sonveil-inline-search">
      <Search size={15} aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('discover.searchPlaceholder')}
      />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label={t('common.close')}>
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
});
