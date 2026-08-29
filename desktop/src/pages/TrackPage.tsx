import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { SoundWaveSimilarBlock } from '../components/music/soundwave';
import { ROOM_KEYFRAMES } from '../components/track/keyframes';
import { LinerNotes } from '../components/track/LinerNotes';
import { RoomHero } from '../components/track/RoomHero';
import { RoomSleeve } from '../components/track/RoomSleeve';
import { RoomVoices } from '../components/track/RoomVoices';
import { useTrackAura } from '../components/track/useTrackAura';
import { api } from '../lib/api';
import { seek } from '../lib/audio';
import { useDislikeVersion } from '../lib/dislikes';
import {
  useInfiniteScroll,
  useRelatedTracks,
  useTrackComments,
  useTrackFavoriters,
} from '../lib/hooks';
import { ChevronLeft, Loader2 } from '../lib/icons';
import { setLikedUrn } from '../lib/likes';
import { curateQueueRecommendations } from '../lib/queue-recommendations';
import { useScdMeta } from '../lib/scdMeta';
import { useAuthStore } from '../stores/auth';
import { type Track, usePlayerStore } from '../stores/player';
import { useSettingsStore } from '../stores/settings';

function HeroSkeleton() {
  return (
    <div className="relative rounded-[2rem] overflow-hidden glass-featured p-6 md:p-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-[2.2rem] skeleton-shimmer shrink-0 self-center lg:self-start" />
        <div className="flex-1 space-y-4 w-full">
          <div className="h-4 w-40 rounded-full skeleton-shimmer" />
          <div className="h-12 w-3/4 rounded-2xl skeleton-shimmer" />
          <div className="h-5 w-48 rounded-full skeleton-shimmer" />
          <div className="h-11 w-64 rounded-full skeleton-shimmer mt-6" />
        </div>
      </div>
      <div className="h-[96px] mt-8 rounded-xl skeleton-shimmer" />
    </div>
  );
}

export const TrackPage = React.memo(function TrackPage() {
  const { urn } = useParams<{ urn: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    data: track,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['track', urn],
    queryFn: ({ signal }) => api<Track>(`/tracks/${encodeURIComponent(urn!)}`, { signal }),
    enabled: !!urn,
    staleTime: 30_000,
  });

  const {
    comments,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: commentsLoading,
  } = useTrackComments(urn);
  const commentsSentinel = useInfiniteScroll(hasNextPage, isFetchingNextPage, fetchNextPage);

  const { data: relatedData, isLoading: relatedLoading } = useRelatedTracks(urn, 24);
  const { data: favoritersData } = useTrackFavoriters(urn, 12);

  const relatedRaw = useMemo(() => relatedData?.collection ?? [], [relatedData]);
  const hideLiked = useSettingsStore((s) => s.soundwaveHideLiked);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const recommendationMode = useSettingsStore((s) => s.soundwaveMode);
  const dislikeVersion = useDislikeVersion();
  const relatedCurated = useMemo(() => {
    void dislikeVersion;
    return curateQueueRecommendations(relatedRaw, track ? [track] : [], {
      hideLiked,
      hideListened,
      mode: recommendationMode,
      limit: 10,
    });
  }, [relatedRaw, track, dislikeVersion, hideLiked, hideListened, recommendationMode]);
  const related = useScdMeta(relatedCurated);
  const favoriters = useMemo(() => favoritersData?.collection ?? [], [favoritersData]);

  const trackUrn = track?.urn;
  const isThis = usePlayerStore((s) => !!trackUrn && s.currentTrack?.urn === trackUrn);
  const isThisPlaying = usePlayerStore(
    (s) => !!trackUrn && s.currentTrack?.urn === trackUrn && s.isPlaying,
  );

  const aura = useTrackAura(track?.genre);
  const myUrn = useAuthStore((s) => s.user?.urn);

  useEffect(() => {
    if (track?.user_favorite && track.urn) setLikedUrn(track.urn, true);
  }, [track?.urn, track?.user_favorite]);

  const handlePlay = useCallback(() => {
    if (!track) return;
    const st = usePlayerStore.getState();
    if (st.currentTrack?.urn === track.urn) {
      if (st.isPlaying) st.pause();
      else st.resume();
    } else {
      st.play(track, [track]);
    }
  }, [track]);

  // Jump into the song from a comment: seek when it's already loaded, else
  // start it (and its voices begin to rise as the playhead sweeps).
  const jumpTo = useCallback(
    (seconds: number) => {
      if (!track) return;
      const st = usePlayerStore.getState();
      if (st.currentTrack?.urn === track.urn) seek(seconds);
      else st.play(track, [track]);
    },
    [track],
  );

  if (isLoading || (!track && !isError)) {
    return (
      <div className="sonveil-detail-page">
        <style>{ROOM_KEYFRAMES}</style>
        <div className="sonveil-detail-content" style={{ isolation: 'isolate' }}>
          <HeroSkeleton />
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="sonveil-detail-page flex items-center justify-center">
        <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
          <Loader2 size={22} className="text-white/15" />
          <p className="text-white/40 text-sm">{t('track.loadError')}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 h-9 pl-2.5 pr-4 rounded-full text-[12px] text-white/70 hover:text-white transition-colors cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '0.5px solid rgba(255,255,255,0.1)',
            }}
          >
            <ChevronLeft size={14} />
            {t('search.back')}
          </button>
        </div>
      </div>
    );
  }

  const isOwner = !!myUrn && track.user?.urn === myUrn;

  return (
    <div className="sonveil-detail-page">
      <style>{ROOM_KEYFRAMES}</style>

      <div className="sonveil-detail-content space-y-7" style={{ isolation: 'isolate' }}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white/55 hover:text-white hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
            aria-label={t('search.back')}
          >
            <ChevronLeft size={18} />
          </button>
          {aura.hasGenre && (
            <span className="text-[10px] uppercase tracking-[0.24em] text-white/20">
              {t('track.roomFor')}
            </span>
          )}
        </div>

        <RoomHero
          track={track}
          aura={aura}
          isThis={isThis}
          isThisPlaying={isThisPlaying}
          isOwner={isOwner}
          comments={comments}
          onPlay={handlePlay}
          onSeek={jumpTo}
        />

        <LinerNotes track={track} aura={aura} />

        <SoundWaveSimilarBlock trackUrn={track.urn} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8 items-start">
          <RoomVoices
            trackUrn={track.urn}
            commentCount={track.comment_count}
            comments={comments}
            loading={commentsLoading}
            fetchingMore={isFetchingNextPage}
            sentinelRef={commentsSentinel}
            isCurrent={isThis}
            aura={aura}
            onSeek={jumpTo}
          />
          <RoomSleeve
            track={track}
            favoriters={favoriters}
            related={related}
            relatedLoading={relatedLoading}
            aura={aura}
          />
        </div>
      </div>
    </div>
  );
});
