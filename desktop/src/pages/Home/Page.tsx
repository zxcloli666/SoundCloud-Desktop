import { ChevronRight, Compass, Heart, Loader2, Music, Sparkles } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useFeed,
  useFollowingTracks,
  useGenreTracks,
  useLikedTracks,
  useRecommendedTracks,
} from '../../api/index.ts';
import type { Track } from '../../api/types.ts';
import { HorizontalScroll } from '../../components/common/HorizontalScroll.tsx';
import { Skeleton } from '../../components/common/Skeleton.tsx';
import { TrackCard } from '../../components/track/TrackCard.tsx';
import { useInfiniteScroll } from '../../lib/useInfiniteScroll.ts';
import { useAuthStore } from '../../stores/auth.ts';
import { FeaturedCard } from './HomeFeaturedCard.tsx';
import { FeedPlaylistCard } from './HomeFeedPlaylistCard.tsx';
import { FeedTrackCard } from './HomeFeedTrackCard.tsx';

function greetingKey() {
  const h = new Date().getHours();
  if (h < 6) return 'home.goodNight';
  if (h < 12) return 'home.goodMorning';
  if (h < 18) return 'home.goodAfternoon';
  return 'home.goodEvening';
}
/* ── Section Header ───────────────────────────────────────── */

function SectionHeader({
  title,
  icon,
  onSeeAll,
}: {
  title: string;
  icon: React.ReactNode;
  onSeeAll?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
          {icon}
        </div>
        <h2 className="text-[15px] font-semibold tracking-tight text-white/90">{title}</h2>
      </div>
      {onSeeAll && (
        <button
          type="button"
          onClick={onSeeAll}
          className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors duration-200 cursor-pointer"
        >
          {t('common.seeAll')}
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

/* ── Skeletons ────────────────────────────────────────────── */

function ShelfSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[180px] shrink-0">
          <Skeleton className="aspect-square w-full" rounded="lg" />
          <Skeleton className="h-4 w-3/4 mt-2.5" rounded="sm" />
          <Skeleton className="h-3 w-1/2 mt-1.5" rounded="sm" />
        </div>
      ))}
    </>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="glass rounded-3xl p-6 flex items-center gap-6">
      <Skeleton className="w-[160px] h-[160px] shrink-0" rounded="lg" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-6 w-3/4" rounded="sm" />
        <Skeleton className="h-4 w-1/3" rounded="sm" />
        <div className="pt-3" />
        <Skeleton className="h-3 w-1/2" rounded="sm" />
      </div>
      <Skeleton className="w-14 h-14 shrink-0" rounded="full" />
    </div>
  );
}

function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-3 flex items-center gap-3.5">
          <Skeleton className="w-[76px] h-[76px] shrink-0" rounded="lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" rounded="sm" />
            <Skeleton className="h-3 w-1/2" rounded="sm" />
            <Skeleton className="h-2.5 w-2/5" rounded="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Home Page ────────────────────────────────────────────── */

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const {
    items: feedItems,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: feedLoading,
  } = useFeed();
  const { data: likes, isLoading: likesLoading } = useLikedTracks(50);
  const { data: following, isLoading: followingLoading } = useFollowingTracks(20);

  const sentinelRef = useInfiniteScroll(hasNextPage, isFetchingNextPage, fetchNextPage);

  const likedTracks = likes?.collection ?? [];
  const followingTracks = following?.collection ?? [];

  // Discover: pick a random liked track as seed for recommendations
  const seedUrn = useMemo(() => {
    if (likedTracks.length === 0) return undefined;
    const i = Math.floor(Math.random() * Math.min(likedTracks.length, 10));
    return likedTracks[i]?.urn;
  }, [likedTracks]);

  const { data: recommended, isLoading: recommendedLoading } = useRecommendedTracks(seedUrn, 20);
  const recommendedTracks = recommended?.collection ?? [];

  // Genre discovery — extract top genres from liked tracks
  const topGenres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of likedTracks) {
      const g = t.genre?.trim().toLowerCase();
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([g]) => g);
  }, [likedTracks]);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const selectedGenre = activeGenre ?? topGenres[0] ?? null;
  const { data: genreData, isLoading: genreLoading } = useGenreTracks(selectedGenre!, 20);

  // First track in feed → featured hero card
  const featuredItem = feedItems.find((i) => i.type.includes('track'));
  const streamItems = feedItems.filter((i) => i !== featuredItem);

  // All feed tracks as queue context
  const feedTrackQueue = feedItems
    .filter((i) => i.type.includes('track'))
    .map((i) => i.origin as Track);

  return (
    <div className="p-6 pb-4 space-y-8">
      {/* ── Hero Greeting ──────────────────────────────── */}
      <section className="pt-1">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white/80 to-accent/80 bg-clip-text text-transparent leading-tight pb-1">
          {t(greetingKey())}
          {user?.username ? `, ${user.username}` : ''}
        </h1>
        <div className="mt-3 h-px bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-transparent" />
      </section>

      {/* ── Featured Track ─────────────────────────────── */}
      {feedLoading ? (
        <FeaturedSkeleton />
      ) : (
        featuredItem && (
          <section>
            <FeaturedCard item={featuredItem} queue={feedTrackQueue} />
          </section>
        )
      )}

      {/* ── Liked Tracks ───────────────────────────────── */}
      {(likesLoading || likedTracks.length > 0) && (
        <section>
          <SectionHeader
            title={t('library.likedTracks')}
            icon={<Heart size={15} className="text-accent" />}
            onSeeAll={() => navigate('/library')}
          />
          <HorizontalScroll>
            {likesLoading ? (
              <ShelfSkeleton />
            ) : (
              likedTracks.map((track) => (
                <div key={track.urn} className="w-[180px] shrink-0">
                  <TrackCard track={track} queue={likedTracks} />
                </div>
              ))
            )}
          </HorizontalScroll>
        </section>
      )}

      {/* ── Fresh Releases ─────────────────────────────── */}
      {(followingLoading || followingTracks.length > 0) && (
        <section>
          <SectionHeader
            title={t('home.freshReleases')}
            icon={<Music size={15} className="text-white/50" />}
          />
          <HorizontalScroll>
            {followingLoading ? (
              <ShelfSkeleton />
            ) : (
              followingTracks.map((track) => (
                <div key={track.urn} className="w-[180px] shrink-0">
                  <TrackCard track={track} queue={followingTracks} />
                </div>
              ))
            )}
          </HorizontalScroll>
        </section>
      )}

      {/* ── Recommended For You ───────────────────────── */}
      {(recommendedLoading || recommendedTracks.length > 0) && (
        <section>
          <SectionHeader
            title={t('home.recommended', 'Recommended For You')}
            icon={<Sparkles size={15} className="text-amber-400/70" />}
          />
          <HorizontalScroll>
            {recommendedLoading ? (
              <ShelfSkeleton />
            ) : (
              recommendedTracks.map((track) => (
                <div key={track.urn} className="w-[180px] shrink-0">
                  <TrackCard track={track} queue={recommendedTracks} />
                </div>
              ))
            )}
          </HorizontalScroll>
        </section>
      )}

      {/* ── Discover by Genre ──────────────────────────── */}
      {topGenres.length > 0 && (
        <section>
          <SectionHeader
            title={t('home.discover', 'Discover')}
            icon={<Compass size={15} className="text-cyan-400/70" />}
          />
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            {topGenres.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setActiveGenre(g)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 cursor-pointer capitalize ${
                  selectedGenre === g
                    ? 'bg-white/[0.12] text-white border border-white/[0.08]'
                    : 'bg-white/[0.03] text-white/40 border border-white/[0.04] hover:bg-white/[0.06] hover:text-white/60'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <HorizontalScroll>
            {genreLoading ? (
              <ShelfSkeleton />
            ) : (
              (genreData?.collection ?? []).map((track) => (
                <div key={track.urn} className="w-[180px] shrink-0">
                  <TrackCard track={track} queue={genreData?.collection ?? []} />
                </div>
              ))
            )}
          </HorizontalScroll>
        </section>
      )}

      {/* ── Feed Stream ────────────────────────────────── */}
      <section>
        <SectionHeader
          title={t('home.yourFeed')}
          icon={<Music size={15} className="text-white/50" />}
        />

        {feedLoading ? (
          <FeedSkeleton />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-2.5">
            {streamItems.map((item, i) => (
              <div
                key={item.origin.urn}
                className="animate-fade-in-up"
                style={{
                  animationDelay: `${Math.min(i * 40, 400)}ms`,
                }}
              >
                {item.type.includes('track') ? (
                  <FeedTrackCard item={item} queue={feedTrackQueue} />
                ) : (
                  <FeedPlaylistCard item={item} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-12 flex items-center justify-center">
          {isFetchingNextPage && <Loader2 size={18} className="text-white/15 animate-spin" />}
          {!feedLoading && !hasNextPage && !isFetchingNextPage && streamItems.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-white/15">
              <div className="h-px w-8 bg-white/[0.06]" />
              <span>{t('home.endOfFeed')}</span>
              <div className="h-px w-8 bg-white/[0.06]" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
