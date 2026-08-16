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
import { USER_PAGE_KEYFRAMES } from '../components/user/keyframes';
import { type TabDescriptor, TabDock } from '../components/user/TabDock';
import { Loader2 } from '../lib/icons';

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const detail = useArtistDetail(id);
  const artist = detail.data;

  const { hasStar, aura } = useArtistStar(id);

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
        <Loader2 size={28} className="text-white/30 animate-spin" />
      </div>
    );
  }

  if (detail.error || !artist) {
    return (
      <div className="relative w-full min-h-screen flex items-center justify-center text-white/40 text-sm">
        {t('common.error')}
      </div>
    );
  }

  return (
    <>
      <style>{USER_PAGE_KEYFRAMES}</style>
      <div className="sonveil-detail-page">
        <div className="sonveil-detail-content" style={{ isolation: 'isolate' }}>
          <ArtistHero artist={artist} hasStar={hasStar} aura={aura} />

          <div className="mt-8">
            <ArtistSoundWave artistId={artist.id} artistName={artist.name} aura={aura} />
          </div>

          <div className="mt-10 mb-8">
            <TabDock<ArtistTabId> tabs={tabs} active={tab} onChange={setTab} aura={aura} />
          </div>

          <div className="sonveil-detail-surface">
            {tab === 'tracks' && (
              <ArtistTracksTab
                artistId={artist.id}
                role="primary"
                aura={aura}
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
                aura={aura}
                sort={featuredSort}
                onSortChange={setFeaturedSort}
                view={featuredView}
                onViewChange={setFeaturedView}
              />
            )}
            {tab === 'covers' && <ArtistCoversTab artistId={artist.id} aura={aura} />}
            {tab === 'albums' && <ArtistAlbumsTab artistId={artist.id} aura={aura} />}
            {tab === 'related' && <ArtistRelatedTab related={artist.related_artists} aura={aura} />}
            {tab === 'about' && <ArtistAboutTab artist={artist} aura={aura} />}
          </div>
        </div>
      </div>
    </>
  );
}
