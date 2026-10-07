import {useQuery} from '@tanstack/react-query';
import React, {useCallback, useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate, useParams} from 'react-router-dom';
import {SoundWaveSimilarBlock} from '../components/music/soundwave';
import {Atmosphere} from '../components/search/Atmosphere';
import {ROOM_KEYFRAMES} from '../components/track/keyframes';
import {LinerNotes} from '../components/track/LinerNotes';
import {RoomHero} from '../components/track/RoomHero';
import {RoomSleeve} from '../components/track/RoomSleeve';
import {RoomVoices} from '../components/track/RoomVoices';
import {useTrackAura} from '../components/track/useTrackAura';
import {LoadErrorState, RefreshPendingHint} from '../components/ui/LoadErrorState';
import {api} from '../lib/api';
import {playAt} from '../lib/audio';
import {
  retryWhileRefreshing,
  useInfiniteScroll,
  useRelatedTracks,
  useTrackComments,
  useTrackFavoriters,
} from '../lib/hooks';
import {ChevronLeft} from '../lib/icons';
import {setLikedUrn} from '../lib/likes';
import {usePerfMode} from '../lib/perf';
import {useAuthStore} from '../stores/auth';
import {type Track, usePlayerStore} from '../stores/player';

function HeroSkeleton() {
  return (
      <div className="relative rounded-[2rem] overflow-hidden glass-featured p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-8">
              <div
                  className="w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-[2.2rem] skeleton-shimmer shrink-0 self-center lg:self-start"/>
              <div className="flex-1 space-y-4 w-full">
                  <div className="h-4 w-40 rounded-full skeleton-shimmer"/>
                  <div className="h-12 w-3/4 rounded-2xl skeleton-shimmer"/>
                  <div className="h-5 w-48 rounded-full skeleton-shimmer"/>
                  <div className="h-11 w-64 rounded-full skeleton-shimmer mt-6"/>
        </div>
      </div>
          <div className="h-[96px] mt-8 rounded-xl skeleton-shimmer"/>
    </div>
  );
}

export const TrackPage = React.memo(function TrackPage() {
  const { urn } = useParams<{ urn: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
    const perf = usePerfMode();

    const {
        data: track,
        isLoading,
        isError,
        isFetching,
        error,
        failureReason,
        refetch,
    } = useQuery({
    queryKey: ['track', urn],
    queryFn: () => api<Track>(`/tracks/${encodeURIComponent(urn!)}`),
    enabled: !!urn,
    staleTime: 30_000,
    ...retryWhileRefreshing,
  });

  const {
    comments,
      fetchNextPage,
      hasNextPage,
      isFetchingNextPage,
    isLoading: commentsLoading,
  } = useTrackComments(urn);
    const commentsSentinel = useInfiniteScroll(hasNextPage, isFetchingNextPage, fetchNextPage);

  const { data: relatedData, isLoading: relatedLoading } = useRelatedTracks(urn, 10);
  const { data: favoritersData } = useTrackFavoriters(urn, 12);

    const related = useMemo(() => relatedData?.collection ?? [], [relatedData]);
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

    const jumpTo = useCallback(
        (seconds: number) => {
            if (track) playAt(track, seconds);
        },
        [track],
    );

    if (isLoading || (!track && !isError)) {
    return (
        <div className="relative min-h-full w-full">
            <style>{ROOM_KEYFRAMES}</style>
            <Atmosphere/>
            <div
                className="relative z-10 max-w-[1320px] mx-auto px-4 md:px-8 pt-5 pb-10"
                style={{isolation: 'isolate'}}
            >
                <HeroSkeleton/>
                <RefreshPendingHint reason={failureReason}/>
            </div>
        </div>
    );
    }

    if (!track) {
        return (
            <div className="relative min-h-full w-full flex items-center justify-center">
                <Atmosphere/>
                <LoadErrorState error={error} retrying={isFetching} onRetry={() => void refetch()}/>
            </div>
        );
    }

    const isOwner = !!myUrn && track.user?.urn === myUrn;

    return (
        <div className="relative min-h-full w-full">
            <style>{ROOM_KEYFRAMES}</style>
            {perf.atmosphere && (
                <Atmosphere
                    tint={aura.tint}
                    energy={isThisPlaying ? Math.min(1, aura.energy + 0.12) : aura.energy}
                />
            )}

            <div
                className="relative z-10 max-w-[1320px] mx-auto px-4 md:px-8 pt-5 pb-10 space-y-7"
                style={{isolation: 'isolate'}}
            >
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white/55 hover:text-white hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
                        aria-label={t('search.back')}
                    >
                        <ChevronLeft size={18}/>
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

                <LinerNotes track={track} aura={aura} onSeek={jumpTo}/>

                <SoundWaveSimilarBlock trackUrn={track.urn}/>

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
