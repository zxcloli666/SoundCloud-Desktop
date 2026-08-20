import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import appIcon from '../../../assets/app-icon.png';
import { designPreviewTracks, isDesignPreview } from '../../../lib/design-preview';
import { isUrnDisliked } from '../../../lib/dislikes';
import { art, dur } from '../../../lib/formatters';
import { curateHomeRecommendations } from '../../../lib/home-recommendations';
import { useHistory, useLikedTracks } from '../../../lib/hooks';
import { Pause, Play, Plus, RefreshCw } from '../../../lib/icons';
import { getArtistDisplay, getDisplayTitle } from '../../../lib/track-display';
import { useTrackPlay } from '../../../lib/useTrackPlay';
import { useAuthStore } from '../../../stores/auth';
import { type Track, usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { historyEntryToTrack } from '../../library/history-utils';
import { LikeButton } from '../../music/LikeButton';
import { useClusterWave } from '../../music/cluster';
import './editorial-home.css';

function uniqueTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (!track.urn || seen.has(track.urn)) return false;
    seen.add(track.urn);
    return true;
  });
}

function trackArtwork(track: Track, size: 't200x200' | 't500x500') {
  const source = track.enrichment?.album?.cover_url || track.artwork_url || track.user.avatar_url;
  return art(source, size) || appIcon;
}

function timeOfDayTitle(hour: number, t: (key: string) => string) {
  if (hour < 6 || hour >= 20) return t('home.editorial.nightRotation');
  if (hour < 12) return t('home.editorial.morningRotation');
  return t('home.editorial.dayRotation');
}

const Artwork = React.memo(function Artwork({
  track,
  size,
}: {
  track: Track;
  size: 'small' | 'large';
}) {
  return (
    <img
      src={trackArtwork(track, size === 'large' ? 't500x500' : 't200x200')}
      alt=""
      draggable={false}
      decoding="async"
      loading={size === 'large' ? 'eager' : 'lazy'}
      className="editorial-artwork"
    />
  );
});

const FeaturedRelease = React.memo(function FeaturedRelease({
  track,
  queue,
  eyebrow,
  fallbackDescription,
}: {
  track: Track;
  queue: Track[];
  eyebrow: string;
  fallbackDescription: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const { isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const artist = getArtistDisplay(track).primary;
  const title = track.enrichment?.album?.title || getDisplayTitle(track);
  const year =
    track.enrichment?.album?.year || track.enrichment?.release_year || track.release_year;
  const description = track.description?.trim() || fallbackDescription;

  return (
    <section className="editorial-feature" aria-labelledby="featured-title">
      <button
        type="button"
        className="editorial-feature-art"
        onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
        aria-label={t('track.openTrackPage')}
      >
        <Artwork track={track} size="large" />
      </button>

      <div className="editorial-feature-copy">
        <p className="editorial-eyebrow">{eyebrow}</p>
        <h2 id="featured-title">{title}</h2>
        <p className="editorial-feature-artist">{artist}</p>
        <div className="editorial-feature-meta">
          {year && <span>{year}</span>}
          <span>{track.genre || t('home.editorial.independent')}</span>
          <span>{dur(track.full_duration ?? track.duration)}</span>
        </div>
        <p className="editorial-feature-description selectable">{description}</p>
        <div className="editorial-feature-actions">
          <button type="button" className="editorial-primary-action" onClick={togglePlay}>
            {isThisPlaying ? (
              <Pause size={15} fill="currentColor" />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
            <span>{isThisPlaying ? t('track.pause') : t('home.editorial.playRelease')}</span>
          </button>
          <LikeButton track={track} variant="editorial" />
          <button
            type="button"
            className="editorial-icon-action"
            onClick={() => addToQueue([track])}
            aria-label={t('player.addToQueue')}
            title={t('player.addToQueue')}
          >
            <Plus size={17} />
          </button>
        </div>
      </div>
    </section>
  );
});

const RecentCard = React.memo(function RecentCard({
  track,
  queue,
}: {
  track: Track;
  queue: Track[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const displayTitle = getDisplayTitle(track);
  const artist = getArtistDisplay(track).primary;

  return (
    <article className="editorial-recent-card">
      <div className="editorial-recent-art">
        <button
          type="button"
          onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
          aria-label={displayTitle}
        >
          <Artwork track={track} size="small" />
        </button>
        <button
          type="button"
          className="editorial-card-play"
          onClick={togglePlay}
          aria-label={isThisPlaying ? t('track.pause') : t('track.play')}
        >
          {isThisPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
        </button>
      </div>
      <button
        type="button"
        className="editorial-recent-title"
        onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
      >
        {displayTitle}
      </button>
      <p>{artist}</p>
    </article>
  );
});

const EditorialTrackRow = React.memo(function EditorialTrackRow({
  track,
  queue,
}: {
  track: Track;
  queue: Track[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const displayTitle = getDisplayTitle(track);
  const artist = getArtistDisplay(track).primary;
  const album = track.enrichment?.album?.title || track.genre || '—';

  return (
    <div className={`editorial-track-row${isThis ? ' is-current' : ''}`}>
      <div className="editorial-row-track">
        <button
          type="button"
          className="editorial-row-art"
          onClick={togglePlay}
          aria-label={isThisPlaying ? t('track.pause') : t('track.play')}
        >
          <Artwork track={track} size="small" />
          <span className="editorial-row-play">
            {isThisPlaying ? (
              <Pause size={12} fill="currentColor" />
            ) : (
              <Play size={12} fill="currentColor" />
            )}
          </span>
        </button>
        <button
          type="button"
          className="editorial-row-title"
          onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
        >
          {displayTitle}
        </button>
      </div>
      <span className="editorial-row-artist">{artist}</span>
      <span className="editorial-row-album">{album}</span>
      <LikeButton track={track} variant="editorial" />
      <span className="editorial-row-time">{dur(track.full_duration ?? track.duration)}</span>
    </div>
  );
});

function EditorialSkeleton() {
  return (
    <div className="editorial-skeleton" aria-hidden="true">
      <div className="editorial-skeleton-feature" />
      <div className="editorial-skeleton-lines">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function RecommendationShelfSkeleton() {
  return (
    <section className="editorial-recommendation-skeleton" aria-hidden="true">
      <span className="editorial-recommendation-skeleton-title" />
      <div className="editorial-recommendation-skeleton-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="editorial-recommendation-skeleton-card" />
        ))}
      </div>
    </section>
  );
}

export function EditorialHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const preview = isDesignPreview();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const recommendationLanguages = useSettingsStore((state) => state.soundwaveLanguages);
  const hideListened = useSettingsStore((state) => state.soundwaveHideListened);
  const likedQuery = useLikedTracks(60, !preview);
  const historyQuery = useHistory(24, !preview);

  const stableLanguages = useMemo(
    () => [...recommendationLanguages].sort(),
    [recommendationLanguages],
  );
  const recommendationUrl = useMemo(() => {
    if (!isAuthenticated || preview) return null;
    const query = new URLSearchParams();
    if (stableLanguages.length > 0) query.set('languages', stableLanguages.join(','));
    query.set('hide_listened', hideListened ? '1' : '0');
    return `/recommendations?${query}`;
  }, [hideListened, isAuthenticated, preview, stableLanguages]);
  const recommendationQuery = useClusterWave({
    queryKey: ['cluster-wave', 'editorial-home', stableLanguages.join(',') || 'all', hideListened],
    url: recommendationUrl,
    enabled: isAuthenticated && !preview,
    staleMs: 5 * 60_000,
    gcMs: 30 * 60_000,
  });

  const recentTracks = useMemo(
    () => uniqueTracks(historyQuery.entries.map(historyEntryToTrack)),
    [historyQuery.entries],
  );
  const rawRecommendations = useMemo(
    () => (preview ? designPreviewTracks : (recommendationQuery.data?.allTracks ?? [])),
    [preview, recommendationQuery.data?.allTracks],
  );
  const excludedRecommendationUrns = useMemo(
    () => new Set([...recentTracks, ...likedQuery.tracks].map((track) => track.urn)),
    [likedQuery.tracks, recentTracks],
  );
  const blockedRecommendationUrns = useMemo(
    () =>
      new Set(
        rawRecommendations.filter((track) => isUrnDisliked(track.urn)).map((track) => track.urn),
      ),
    [rawRecommendations],
  );
  const recommendations = useMemo(
    () =>
      curateHomeRecommendations(rawRecommendations, {
        excludedUrns: excludedRecommendationUrns,
        blockedUrns: blockedRecommendationUrns,
        limit: 20,
      }),
    [blockedRecommendationUrns, excludedRecommendationUrns, rawRecommendations],
  );
  const allTracks = useMemo(() => {
    return uniqueTracks([...recommendations, ...recentTracks, ...likedQuery.tracks]);
  }, [likedQuery.tracks, recentTracks, recommendations]);
  const recent = recentTracks.slice(0, 8);
  const featured = recommendations[0] || recent[0] || likedQuery.tracks[0];
  const featuredIsRecommendation = featured?.urn === recommendations[0]?.urn;
  const recommendationStart = featuredIsRecommendation ? 1 : 0;
  const recommendationCards = recommendations.slice(recommendationStart, recommendationStart + 6);
  const tableTracks = recommendations.slice(recommendationStart + 6, recommendationStart + 13);
  const title = timeOfDayTitle(preview ? 23 : new Date().getHours(), t);
  const loading =
    !featured && (likedQuery.isLoading || historyQuery.isLoading || recommendationQuery.isLoading);
  const showRecommendationEmpty =
    isAuthenticated &&
    !preview &&
    !recommendationQuery.isLoading &&
    recommendations.length === 0 &&
    (recent.length > 0 || likedQuery.tracks.length > 0);

  return (
    <div className="editorial-home">
      <h1>{title}</h1>

      {featured ? (
        <FeaturedRelease
          track={featured}
          queue={allTracks}
          eyebrow={
            featuredIsRecommendation
              ? t('home.editorial.recommendationSpotlight')
              : t('home.editorial.featuredRelease')
          }
          fallbackDescription={
            featuredIsRecommendation
              ? t('home.editorial.recommendationDescription')
              : t('home.editorial.featuredDescription')
          }
        />
      ) : loading ? (
        <EditorialSkeleton />
      ) : (
        <div className="editorial-empty">
          <p>{t('home.startLikingTitle')}</p>
          <button
            type="button"
            className="editorial-empty-action"
            onClick={() => navigate('/search')}
          >
            {t('nav.search')}
          </button>
        </div>
      )}

      {recommendationQuery.isLoading && recommendations.length === 0 && (
        <RecommendationShelfSkeleton />
      )}

      {recommendationCards.length > 0 && (
        <section
          className="editorial-recent editorial-recommendations"
          aria-labelledby="recommendations-title"
        >
          <header>
            <div className="editorial-section-copy">
              <h2 id="recommendations-title">{t('home.recommended')}</h2>
              <p>{t('home.editorial.recommendationSubtitle')}</p>
            </div>
            {!preview && (
              <button
                type="button"
                onClick={() => void recommendationQuery.refetch()}
                disabled={recommendationQuery.isFetching}
                aria-label={t('soundwave.refresh')}
              >
                <RefreshCw
                  size={13}
                  className={recommendationQuery.isFetching ? 'animate-spin' : undefined}
                />
                <span>{t('soundwave.refresh')}</span>
              </button>
            )}
          </header>
          <div className="editorial-recent-grid">
            {recommendationCards.map((track) => (
              <RecentCard key={track.urn} track={track} queue={recommendations} />
            ))}
          </div>
        </section>
      )}

      {showRecommendationEmpty && (
        <section className="editorial-recommendation-empty" aria-live="polite">
          <div>
            <h2>{t('home.recommended')}</h2>
            <p>{t('home.editorial.recommendationsEmpty')}</p>
          </div>
          <button
            type="button"
            className="editorial-recommendation-refresh"
            onClick={() => void recommendationQuery.refetch()}
            disabled={recommendationQuery.isFetching}
          >
            <RefreshCw
              size={14}
              className={recommendationQuery.isFetching ? 'animate-spin' : undefined}
            />
            {t('soundwave.refresh')}
          </button>
        </section>
      )}

      {recent.length > 0 && (
        <section className="editorial-recent" aria-labelledby="recent-title">
          <header>
            <h2 id="recent-title">{t('home.editorial.recentlyPlayed')}</h2>
            <button type="button" onClick={() => navigate('/library?tab=history')}>
              {t('common.seeAll')}
            </button>
          </header>
          <div className="editorial-recent-grid">
            {recent.map((track) => (
              <RecentCard key={track.urn} track={track} queue={allTracks} />
            ))}
          </div>
        </section>
      )}

      {tableTracks.length > 0 && (
        <section
          className="editorial-track-table"
          aria-label={t('home.editorial.recommendationMore')}
        >
          <div className="editorial-track-label">{t('home.editorial.recommendationMore')}</div>
          <div className="editorial-track-head">
            <span>{t('home.editorial.title')}</span>
            <span>{t('home.editorial.artist')}</span>
            <span>{t('home.editorial.album')}</span>
            <span />
            <span>{t('home.editorial.time')}</span>
          </div>
          {tableTracks.map((track) => (
            <EditorialTrackRow key={track.urn} track={track} queue={allTracks} />
          ))}
        </section>
      )}
    </div>
  );
}
