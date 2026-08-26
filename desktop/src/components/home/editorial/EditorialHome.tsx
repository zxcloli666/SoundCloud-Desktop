import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import appIcon from '../../../assets/app-icon.png';
import { designPreviewTracks, isDesignPreview } from '../../../lib/design-preview';
import { isUrnDisliked, useDislikeVersion } from '../../../lib/dislikes';
import { art, dur } from '../../../lib/formatters';
import {
  curateHomeRecommendations,
  type HomeRecommendationFeedback,
  type HomeRecommendationInput,
} from '../../../lib/home-recommendations';
import { useHistory, useLikedTracks } from '../../../lib/hooks';
import { Pause, Play, Plus, RefreshCw } from '../../../lib/icons';
import { recordClusterFeedback, setUrnCluster } from '../../../lib/recsFeedback';
import { getArtistDisplay, getDisplayTitle } from '../../../lib/track-display';
import { useTrackPlay } from '../../../lib/useTrackPlay';
import { useAuthStore } from '../../../stores/auth';
import { type Track, usePlayerStore } from '../../../stores/player';
import { useRecommendationTasteStore } from '../../../stores/recommendation-taste';
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

function recommendationTrack(input: HomeRecommendationInput): Track {
  return 'track' in input && Array.isArray(input.sources) ? input.track : input;
}

function recommendationCluster(input: HomeRecommendationInput): string | null {
  if (!('track' in input) || !Array.isArray(input.sources) || input.sources.length === 0) {
    return null;
  }
  let best = input.sources[0];
  for (let index = 1; index < input.sources.length; index++) {
    const source = input.sources[index];
    if (
      source.rank < best.rank ||
      (source.rank === best.rank && (source.score ?? Number.NEGATIVE_INFINITY) >
        (best.score ?? Number.NEGATIVE_INFINITY))
    ) {
      best = source;
    }
  }
  return best.clusterId;
}

type RecommendationPlayHandler = (track: Track) => void;

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
  onPlay,
}: {
  track: Track;
  queue: Track[];
  eyebrow: string;
  fallbackDescription: string;
  onPlay?: RecommendationPlayHandler;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const handleNewPlay = useCallback(() => onPlay?.(track), [onPlay, track]);
  const { isThisPlaying, togglePlay } = useTrackPlay(track, queue, handleNewPlay);
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
  onPlay,
}: {
  track: Track;
  queue: Track[];
  onPlay?: RecommendationPlayHandler;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const handleNewPlay = useCallback(() => onPlay?.(track), [onPlay, track]);
  const { isThisPlaying, togglePlay } = useTrackPlay(track, queue, handleNewPlay);
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
  onPlay,
}: {
  track: Track;
  queue: Track[];
  onPlay?: RecommendationPlayHandler;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const handleNewPlay = useCallback(() => onPlay?.(track), [onPlay, track]);
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue, handleNewPlay);
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

interface EditorialRecommendationEpoch {
  ownerKey: string;
  sourceUpdatedAt: number;
  mode: 'similar' | 'diverse';
  rawRecommendations: HomeRecommendationInput[];
  likedTracks: Track[];
  recentTracks: Track[];
  feedback: HomeRecommendationFeedback;
  exposureCounts: ReadonlyMap<string, number>;
  rotationEpoch: number;
  previousTopUrn?: string;
  now: number;
}

interface RecommendationRotationState {
  ownerKey: string;
  exposureCounts: ReadonlyMap<string, number>;
  epoch: number;
  previousTopUrn?: string;
}

const EMPTY_EXPOSURE_COUNTS: ReadonlyMap<string, number> = new Map();

export function EditorialHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const preview = isDesignPreview();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const recommendationLanguages = useSettingsStore((state) => state.soundwaveLanguages);
  const hideLiked = useSettingsStore((state) => state.soundwaveHideLiked);
  const hideListened = useSettingsStore((state) => state.soundwaveHideListened);
  const recommendationMode = useSettingsStore((state) => state.soundwaveMode);
  const tasteOwnerUrn = useRecommendationTasteStore((state) => state.ownerUrn);
  const tasteOwnerReady = useRecommendationTasteStore((state) => state.ownerReady);
  const ownerKey = tasteOwnerReady ? (tasteOwnerUrn ?? 'anonymous') : 'pending';
  const dislikeVersion = useDislikeVersion();
  const [rotationState, setRotationState] = useState<RecommendationRotationState>(() => ({
    ownerKey,
    exposureCounts: EMPTY_EXPOSURE_COUNTS,
    epoch: 0,
  }));
  const exposureCounts =
    rotationState.ownerKey === ownerKey
      ? rotationState.exposureCounts
      : EMPTY_EXPOSURE_COUNTS;
  const rotationEpoch = rotationState.ownerKey === ownerKey ? rotationState.epoch : 0;
  const previousTopUrn =
    rotationState.ownerKey === ownerKey ? rotationState.previousTopUrn : undefined;
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
  const refetchRecommendationsQuery = recommendationQuery.refetch;

  const candidateSource = useMemo<HomeRecommendationInput[]>(
    () => (preview ? designPreviewTracks : (recommendationQuery.data?.candidates ?? [])),
    [preview, recommendationQuery.data?.candidates],
  );
  const rankingEpoch = useMemo<EditorialRecommendationEpoch>(() => {
    const localTaste = useRecommendationTasteStore.getState();
    const canUseLocalTaste =
      !preview &&
      tasteOwnerReady &&
      Boolean(tasteOwnerUrn) &&
      localTaste.ownerReady &&
      localTaste.ownerUrn === tasteOwnerUrn;
    return {
      ownerKey,
      sourceUpdatedAt: recommendationQuery.dataUpdatedAt,
      mode: recommendationMode,
      rawRecommendations: [...candidateSource],
      likedTracks: [...likedQuery.tracks],
      recentTracks: uniqueTracks([
        ...(canUseLocalTaste ? localTaste.recentTracks : []),
        ...historyQuery.entries.map(historyEntryToTrack),
      ]),
      feedback: canUseLocalTaste
        ? { tracks: localTaste.tracks, clusters: localTaste.clusters }
        : {},
      exposureCounts,
      rotationEpoch,
      previousTopUrn,
      now: Date.now(),
    };
  }, [
    candidateSource,
    exposureCounts,
    historyQuery.entries,
    likedQuery.tracks,
    ownerKey,
    preview,
    recommendationMode,
    recommendationQuery.dataUpdatedAt,
    rotationEpoch,
    previousTopUrn,
    tasteOwnerReady,
    tasteOwnerUrn,
  ]);
  const rawRecommendations = rankingEpoch.rawRecommendations;
  const recentTracks = rankingEpoch.recentTracks;
  const likedTracks = rankingEpoch.likedTracks;
  const excludedRecommendationUrns = useMemo(
    () =>
      new Set(
        [
          ...(hideListened ? [] : recentTracks),
          ...(hideLiked ? [] : likedTracks),
        ].map((track) => track.urn),
      ),
    [hideLiked, hideListened, likedTracks, recentTracks],
  );
  const blockedRecommendationUrns = useMemo(
    () => {
      void dislikeVersion;
      const blocked = new Set<string>();
      for (const input of rawRecommendations) {
        const track = recommendationTrack(input);
        if (isUrnDisliked(track.urn)) blocked.add(track.urn);
      }
      if (hideListened) {
        for (const track of recentTracks) blocked.add(track.urn);
      }
      if (hideLiked) {
        for (const track of likedTracks) blocked.add(track.urn);
      }
      return blocked;
    },
    [dislikeVersion, hideLiked, hideListened, likedTracks, rawRecommendations, recentTracks],
  );
  const recommendations = useMemo(
    () =>
      curateHomeRecommendations(rawRecommendations, {
        excludedUrns: excludedRecommendationUrns,
        blockedUrns: blockedRecommendationUrns,
        likedTracks,
        recentTracks,
        mode: rankingEpoch.mode,
        feedback: rankingEpoch.feedback,
        exposureCounts: rankingEpoch.exposureCounts,
        rotationEpoch: rankingEpoch.rotationEpoch,
        previousTopUrn: rankingEpoch.previousTopUrn,
        limit: 20,
        now: rankingEpoch.now,
      }),
    [
      blockedRecommendationUrns,
      excludedRecommendationUrns,
      likedTracks,
      rawRecommendations,
      recentTracks,
      rankingEpoch,
    ],
  );
  const recommendationAttribution = useMemo(() => {
    const attribution = new Map<string, string>();
    if (preview) return attribution;
    for (const input of rawRecommendations) {
      const cluster = recommendationCluster(input);
      if (cluster) attribution.set(recommendationTrack(input).urn, cluster);
    }
    return attribution;
  }, [preview, rawRecommendations]);
  const handleRecommendationPlay = useCallback<RecommendationPlayHandler>(
    (track) => {
      const cluster = recommendationAttribution.get(track.urn);
      if (!cluster) return;
      setUrnCluster(track.urn, cluster);
      recordClusterFeedback(cluster, 'click');
    },
    [recommendationAttribution],
  );
  const allTracks = useMemo(() => {
    return uniqueTracks([...recommendations, ...recentTracks, ...likedTracks]);
  }, [likedTracks, recentTracks, recommendations]);
  const recent = recentTracks.slice(0, 8);
  const featured = recommendations[0] || recent[0] || likedTracks[0];
  const featuredIsRecommendation = featured?.urn === recommendations[0]?.urn;
  const recommendationStart = featuredIsRecommendation ? 1 : 0;
  const recommendationCards = recommendations.slice(recommendationStart, recommendationStart + 6);
  const tableTracks = recommendations.slice(recommendationStart + 6, recommendationStart + 13);
  const title = timeOfDayTitle(preview ? 23 : new Date().getHours(), t);
  const refreshRecommendations = useCallback(() => {
    setRotationState((previousState) => {
      const nextExposureCounts = new Map(
        previousState.ownerKey === ownerKey
          ? previousState.exposureCounts
          : EMPTY_EXPOSURE_COUNTS,
      );
      recommendations.slice(0, 14).forEach((track, index) => {
        const previous = nextExposureCounts.get(track.urn) ?? 0;
        const positionWeight = 1 + (14 - index) / 14;
        nextExposureCounts.delete(track.urn);
        nextExposureCounts.set(track.urn, Math.min(4, previous + positionWeight));
      });
      while (nextExposureCounts.size > 200) {
        const oldest = nextExposureCounts.keys().next().value;
        if (typeof oldest !== 'string') break;
        nextExposureCounts.delete(oldest);
      }
      return {
        ownerKey,
        exposureCounts: nextExposureCounts,
        epoch: previousState.ownerKey === ownerKey ? previousState.epoch + 1 : 1,
        previousTopUrn: recommendations[0]?.urn,
      };
    });
    void refetchRecommendationsQuery();
  }, [ownerKey, recommendations, refetchRecommendationsQuery]);
  const loading =
    !featured && (likedQuery.isLoading || historyQuery.isLoading || recommendationQuery.isLoading);
  const showRecommendationEmpty =
    isAuthenticated &&
    !preview &&
    !recommendationQuery.isLoading &&
    recommendations.length === 0 &&
    (recent.length > 0 || likedTracks.length > 0);

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
          onPlay={featuredIsRecommendation ? handleRecommendationPlay : undefined}
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
                onClick={refreshRecommendations}
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
              <RecentCard
                key={track.urn}
                track={track}
                queue={recommendations}
                onPlay={handleRecommendationPlay}
              />
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
            onClick={refreshRecommendations}
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
            <EditorialTrackRow
              key={track.urn}
              track={track}
              queue={allTracks}
              onPlay={handleRecommendationPlay}
            />
          ))}
        </section>
      )}
    </div>
  );
}
