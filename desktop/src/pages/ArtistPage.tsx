import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ArtistAboutTab } from '../components/artist/ArtistAboutTab';
import { ArtistAlbumsTab } from '../components/artist/ArtistAlbumsTab';
import { ArtistCoversTab } from '../components/artist/ArtistCoversTab';
import { ArtistHero } from '../components/artist/ArtistHero';
import { ArtistRelatedTab } from '../components/artist/ArtistRelatedTab';
import { ArtistTracksTab, type TracksView } from '../components/artist/ArtistTracksTab';
import type { ArtistTabId, TracksSort } from '../components/artist/types';
import {
  useArtistCovers,
  useArtistDetail,
  useArtistStar,
} from '../components/artist/useArtistData';
import { ArtistSoundWave } from '../components/artist/wave';
import { LoadErrorState } from '../components/ui/LoadErrorState';
import { USER_PAGE_KEYFRAMES } from '../components/user/keyframes';
import { type TabDescriptor, TabDock } from '../components/user/TabDock';
import { Loader2 } from '../lib/icons';
import { usePageGlow } from '../lib/page-glow';

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const detail = useArtistDetail(id);
  const artist = detail.data;

  const { hasStar, aura } = useArtistStar(id);
  const glow = usePageGlow(aura.orbs, hasStar ? 'star' : 'page', hasStar ? aura : null);

  const [tab, setTab] = useState<ArtistTabId>('tracks');
  const [primarySort, setPrimarySort] = useState<TracksSort>('popular');
  const [featuredSort, setFeaturedSort] = useState<TracksSort>('popular');
  const [primaryView, setPrimaryView] = useState<TracksView>('list');
  const [featuredView, setFeaturedView] = useState<TracksView>('list');

  const coversQuery = useArtistCovers(id);
  const coversCount = coversQuery.data?.length ?? 0;

  const tabs = useMemo<ReadonlyArray<TabDescriptor<ArtistTabId>>>(() => {
    if (!artist) return [];
    const out: TabDescriptor<ArtistTabId>[] = [
      { id: 'tracks', label: t('artist.tracks'), count: artist.track_count_primary },
    ];
    if (artist.track_count_featured > 0) {
      out.push({
        id: 'appears',
        label: t('artist.appearsOn'),
        count: artist.track_count_featured,
      });
    }
    if (coversCount > 0) {
      out.push({ id: 'covers', label: t('artist.covers', 'Covers'), count: coversCount });
    }
    out.push({ id: 'albums', label: t('artist.albums'), count: artist.album_count });
    out.push({
      id: 'related',
      label: t('artist.related'),
      count: artist.related_artists.length,
    });
    out.push({ id: 'about', label: t('artist.about'), count: undefined });
    return out;
  }, [artist, t, coversCount]);

  if (detail.isLoading || (!artist && !detail.error)) {
    return (
      <div className="relative w-full min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="text-ink-30 animate-spin" />
      </div>
    );
  }

  if (detail.error || !artist) {
    return (
      <div className="relative w-full min-h-screen flex items-center justify-center text-ink-40 text-sm">
        <LoadErrorState
          error={detail.error}
          retrying={detail.isFetching}
          onRetry={() => void detail.refetch()}
        />
      </div>
    );
  }

  return (
    <>
      <style>{USER_PAGE_KEYFRAMES}</style>
      <div data-ui="page" data-page="artist" className="relative w-full min-h-screen">

        <div
          className="relative z-10 w-full max-w-[1480px] mx-auto px-4 md:px-8 pt-6 md:pt-8 pb-32"
          style={{ isolation: 'isolate' }}
        >
          <ArtistHero artist={artist} hasStar={hasStar} aura={aura} glow={glow} />

          <div className="mt-8">
            <ArtistSoundWave artistId={artist.id} artistName={artist.name} />
          </div>

          <div className="mt-10 mb-8">
            <TabDock<ArtistTabId> tabs={tabs} active={tab} onChange={setTab} />
          </div>

          <div className="panel p-3 md:p-5">
            {tab === 'tracks' && (
              <ArtistTracksTab
                artistId={artist.id}
                role="primary"
                sort={primarySort}
                onSortChange={setPrimarySort}
                view={primaryView}
                onViewChange={setPrimaryView}
              />
            )}
            {tab === 'appears' && (
              <ArtistTracksTab
                artistId={artist.id}
                role="featured"
                sort={featuredSort}
                onSortChange={setFeaturedSort}
                view={featuredView}
                onViewChange={setFeaturedView}
              />
            )}
            {tab === 'covers' && <ArtistCoversTab artistId={artist.id} />}
            {tab === 'albums' && <ArtistAlbumsTab artistId={artist.id} />}
            {tab === 'related' && <ArtistRelatedTab related={artist.related_artists} />}
            {tab === 'about' && <ArtistAboutTab artist={artist} />}
          </div>
        </div>
      </div>
    </>
  );
}
