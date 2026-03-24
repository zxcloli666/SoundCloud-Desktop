import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { LikeButton } from '../components/music/LikeButton';
import { TrackCard } from '../components/music/TrackCard';
import { HorizontalScroll } from '../components/ui/HorizontalScroll';
import { Skeleton } from '../components/ui/Skeleton';
import { preloadTrack } from '../lib/audio';
import { ago, art, dur, fc } from '../lib/formatters';
import type { FeedItem } from '../lib/hooks';
import {
  useDiscoverData,
  useFallbackTracks,
  useFeed,
  useFollowingTracks,
  useInfiniteScroll,
  useLikedTracks,
  useRecommendedTracks,
  useRelatedPool,
} from '../lib/hooks';
import {
  ChevronRight,
  Compass,
  Headphones,
  Heart,
  headphones9,
  heart9,
  ListMusic,
  Loader2,
  listMusic8,
  listMusic9,
  Music,
  musicIcon22,
  pauseBlack14,
  pauseBlack18,
  pauseBlack22,
  playBlack14,
  playBlack18,
  playBlack22,
  Repeat2,
  Sparkles,
} from '../lib/icons';
import { useTrackPlay } from '../lib/useTrackPlay';
import { useAuthStore } from '../stores/auth';
import type { Track } from '../stores/player';
import { usePlayerStore } from '../stores/player';

/* ── Helpers ──────────────────────────────────────────────── */

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
        <div key={i} className="glass-flat rounded-2xl p-3 flex items-center gap-3.5">
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

/* ── Featured Card (hero, first feed track) ───────────────── */

const FeaturedCard = React.memo(
  function FeaturedCard({ item, queue }: { item: FeedItem; queue: Track[] }) {
    const { t } = useTranslation();
    const track = item.origin as Track;
    const { isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const navigate = useNavigate();
    const isRepost = item.type.includes('repost');
    const cover = art(track.artwork_url);
    const avatar = art(track.user.avatar_url, 'small');

    return (
      <div
        className="relative rounded-3xl overflow-hidden group glass-featured select-none"
        onMouseEnter={() => preloadTrack(track.urn)}
      >
        {/* Blurred artwork background */}
        {cover && (
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={cover}
              alt=""
              className="w-full h-full object-cover scale-[1.4] blur-[80px] opacity-20 saturate-150"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[rgb(8,8,10)]/70 via-[rgb(8,8,10)]/50 to-[rgb(8,8,10)]/70" />
          </div>
        )}

        {/* Content */}
        <div className="relative flex items-center gap-6 p-6">
          {/* Artwork */}
          <div
            className="relative w-[160px] h-[160px] rounded-2xl overflow-hidden shrink-0 shadow-2xl ring-1 ring-white/[0.1] cursor-pointer group/cover"
            onClick={togglePlay}
          >
            {cover ? (
              <img
                src={cover}
                alt={track.title}
                className="w-full h-full object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover/cover:scale-[1.05]"
                decoding="async"
                fetchPriority="high"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                <Music size={40} className="text-white/15" />
              </div>
            )}

            {/* Hover play overlay on artwork */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                isThisPlaying
                  ? 'bg-black/30 opacity-100'
                  : 'bg-black/0 opacity-0 group-hover/cover:bg-black/30 group-hover/cover:opacity-100'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ease-[var(--ease-apple)] ${
                  isThisPlaying
                    ? 'bg-white scale-100'
                    : 'bg-white/90 scale-75 group-hover/cover:scale-100'
                }`}
              >
                {isThisPlaying ? pauseBlack18 : playBlack18}
              </div>
            </div>
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0 py-1">
            {isRepost && (
              <div className="flex items-center gap-1.5 mb-2.5 text-[11px] text-white/30 font-medium">
                <Repeat2 size={11} />
                <span>{t('home.reposted')}</span>
                <span className="text-white/15">·</span>
                <span>{ago(item.created_at)}</span>
              </div>
            )}

            <h2
              className="text-xl font-bold text-white/95 truncate leading-tight cursor-pointer hover:text-white transition-colors duration-200"
              onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
            >
              {track.title}
            </h2>

            <div
              className="flex items-center gap-2 mt-2 cursor-pointer group/artist"
              onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
            >
              {avatar && (
                <img
                  src={avatar}
                  alt=""
                  className="w-5 h-5 rounded-full ring-1 ring-white/[0.08] group-hover/artist:ring-white/[0.15] transition-all duration-150"
                  decoding="async"
                />
              )}
              <p className="text-[13px] text-white/40 truncate group-hover/artist:text-white/60 transition-colors duration-150">
                {track.user.username}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-4 flex-wrap">
              {track.genre && (
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/[0.06] text-white/45 border border-white/[0.06]">
                  {track.genre}
                </span>
              )}
              <div className="flex items-center gap-3 text-[11px] text-white/25 tabular-nums">
                <span className="flex items-center gap-1">
                  <Headphones size={11} />
                  {fc(track.playback_count)}
                </span>
                <span className="flex items-center gap-1">
                  <Heart size={11} />
                  {fc(track.favoritings_count ?? track.likes_count)}
                </span>
                <span>{dur(track.duration)}</span>
                {!isRepost && <span>{ago(item.created_at)}</span>}
              </div>
            </div>
          </div>

          {/* Large play button */}
          <button
            type="button"
            onClick={togglePlay}
            className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ease-[var(--ease-apple)] shadow-xl cursor-pointer ${
              isThisPlaying
                ? 'bg-white scale-100'
                : 'bg-white/90 hover:bg-white hover:scale-105 active:scale-95'
            }`}
          >
            {isThisPlaying ? pauseBlack22 : playBlack22}
          </button>
        </div>
      </div>
    );
  },
  (prev, next) => prev.item.origin.urn === next.item.origin.urn,
);

/* ── Feed Track Card (compact horizontal) ─────────────────── */

const FeedTrackCard = React.memo(
  function FeedTrackCard({ item, queue }: { item: FeedItem; queue: Track[] }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const track = item.origin as Track;
    const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const isRepost = item.type.includes('repost');
    const cover = art(track.artwork_url, 't300x300');

    return (
      <div
        className={`group glass-flat rounded-2xl p-3 flex items-center gap-3.5 transition-all duration-300 ease-[var(--ease-apple)] select-none ${
          isThis ? 'ring-1 ring-accent/20 bg-accent/[0.02]' : 'hover:bg-white/[0.035]'
        }`}
        onMouseEnter={() => preloadTrack(track.urn)}
      >
        {/* Artwork */}
        <div
          className="relative w-[76px] h-[76px] rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.06] cursor-pointer"
          onClick={togglePlay}
        >
          {cover ? (
            <img
              src={cover}
              alt={track.title}
              className="w-full h-full object-cover"
              decoding="async"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
              {musicIcon22}
            </div>
          )}

          {/* Play overlay */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
              isThisPlaying
                ? 'bg-black/30 opacity-100'
                : 'bg-black/0 opacity-0 group-hover:bg-black/30 group-hover:opacity-100'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ease-[var(--ease-apple)] ${
                isThisPlaying ? 'bg-white scale-100' : 'bg-white/90 scale-75 group-hover:scale-100'
              }`}
            >
              {isThisPlaying ? pauseBlack14 : playBlack14}
            </div>
          </div>
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          {isRepost && (
            <div className="flex items-center gap-1 mb-1 text-[10px] text-white/20 font-medium">
              <Repeat2 size={9} />
              <span>{t('home.reposted')}</span>
            </div>
          )}
          <p
            className="text-[13px] font-medium text-white/90 truncate leading-snug cursor-pointer hover:text-white transition-colors duration-150"
            onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
          >
            {track.title}
          </p>
          <p
            className="text-[11px] text-white/35 truncate mt-0.5 cursor-pointer hover:text-white/55 transition-colors duration-150"
            onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
          >
            {track.user.username}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/20 tabular-nums">
            {track.genre && (
              <span className="px-1.5 py-px rounded-full bg-white/[0.04] text-white/30 border border-white/[0.04] text-[9px]">
                {track.genre}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              {headphones9}
              {fc(track.playback_count)}
            </span>
            <span className="flex items-center gap-0.5">
              {heart9}
              {fc(track.favoritings_count ?? track.likes_count)}
            </span>
          </div>
        </div>

        {/* Like */}
        <LikeButton track={track} />

        {/* Duration + time */}
        <div className="text-right shrink-0 self-center">
          <p className="text-[11px] text-white/30 tabular-nums font-medium">
            {dur(track.duration)}
          </p>
          <p className="text-[10px] text-white/15 mt-0.5">{ago(item.created_at)}</p>
        </div>
      </div>
    );
  },
  (prev, next) => prev.item.origin.urn === next.item.origin.urn,
);

/* ── Feed Playlist Card ───────────────────────────────────── */

const FeedPlaylistCard = React.memo(
  function FeedPlaylistCard({ item }: { item: FeedItem }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const origin = item.origin;
    const isRepost = item.type.includes('repost');
    const cover =
      art(origin.artwork_url, 't300x300') ?? art(origin.tracks?.[0]?.artwork_url, 't300x300');

    // Only re-render when this playlist's playing state actually changes
    const trackUrns = useMemo(
      () => new Set((origin.tracks ?? []).map((t: Track) => t.urn)),
      [origin.tracks],
    );
    const { isPausedFromThis, isPlayingFromThis } = usePlayerStore(
      useShallow((s) => ({
        isPlayingFromThis:
          s.isPlaying && s.currentTrack != null && trackUrns.has(s.currentTrack.urn),
        isPausedFromThis:
          !s.isPlaying && s.currentTrack != null && trackUrns.has(s.currentTrack.urn),
      })),
    );

    const handlePlay = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const { play, pause, resume } = usePlayerStore.getState();
      if (isPlayingFromThis) {
        pause();
        return;
      }
      if (isPausedFromThis) {
        resume();
        return;
      }

      if (origin.tracks && origin.tracks.length > 0) {
        play(origin.tracks[0], origin.tracks);
        return;
      }

      setLoading(true);
      try {
        const data = await import('../lib/api').then((m) =>
          m.api<{ collection: Track[] }>(`/playlists/${encodeURIComponent(origin.urn)}/tracks`),
        );
        const tracks = data.collection;
        if (tracks.length > 0) {
          play(tracks[0], tracks);
        }
      } catch {
        navigate(`/playlist/${encodeURIComponent(origin.urn)}`);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div
        className={`group glass-flat rounded-2xl p-3 flex items-center gap-3.5 transition-all duration-300 ease-[var(--ease-apple)] select-none ${
          isPlayingFromThis ? 'ring-1 ring-accent/20 bg-accent/[0.02]' : 'hover:bg-white/[0.035]'
        }`}
      >
        {/* Artwork */}
        <div
          className="relative w-[76px] h-[76px] rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.06] cursor-pointer"
          onClick={handlePlay}
        >
          {cover ? (
            <img
              src={cover}
              alt={origin.title}
              className="w-full h-full object-cover"
              decoding="async"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
              <ListMusic size={22} className="text-white/15" />
            </div>
          )}

          {/* Play overlay */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
              isPlayingFromThis
                ? 'bg-black/30 opacity-100'
                : 'bg-black/0 opacity-0 group-hover:bg-black/30 group-hover:opacity-100'
            }`}
          >
            {loading ? (
              <Loader2 size={16} className="text-white animate-spin" />
            ) : (
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ease-[var(--ease-apple)] ${
                  isPlayingFromThis
                    ? 'bg-white scale-100'
                    : 'bg-white/90 scale-75 group-hover:scale-100'
                }`}
              >
                {isPlayingFromThis ? pauseBlack14 : playBlack14}
              </div>
            )}
          </div>

          {/* Track count pill */}
          {origin.track_count != null && (
            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-[9px] font-medium bg-black/50 backdrop-blur-md text-white/70 px-1.5 py-0.5 rounded-full">
              {listMusic8}
              {origin.track_count}
            </div>
          )}
        </div>

        {/* Playlist info */}
        <div className="flex-1 min-w-0">
          {isRepost && (
            <div className="flex items-center gap-1 mb-1 text-[10px] text-white/20 font-medium">
              <Repeat2 size={9} />
              <span>{t('home.reposted')}</span>
            </div>
          )}
          <p
            className="text-[13px] font-medium text-white/90 truncate leading-snug cursor-pointer hover:text-white transition-colors duration-150"
            onClick={() => navigate(`/playlist/${encodeURIComponent(origin.urn)}`)}
          >
            {origin.title}
          </p>
          <p
            className="text-[11px] text-white/35 truncate mt-0.5 cursor-pointer hover:text-white/55 transition-colors duration-150"
            onClick={() =>
              origin.user?.urn && navigate(`/user/${encodeURIComponent(origin.user.urn)}`)
            }
          >
            {origin.user?.username}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/20">
            <span className="flex items-center gap-0.5">
              {listMusic9}
              {origin.track_count ?? 0} {t('search.tracks').toLowerCase()}
            </span>
          </div>
        </div>

        {/* Time */}
        <div className="text-right shrink-0 self-center">
          <p className="text-[10px] text-white/15">{ago(item.created_at)}</p>
        </div>
      </div>
    );
  },
  (prev, next) => prev.item.origin.urn === next.item.origin.urn,
);

/* ── Isolated Sections ────────────────────────────────────── */

const FeaturedHero = React.memo(function FeaturedHero({
  featuredItem,
  feedTrackQueue,
  isLoading,
}: {
  featuredItem: FeedItem | undefined;
  feedTrackQueue: Track[];
  isLoading: boolean;
}) {
  if (isLoading) return <FeaturedSkeleton />;
  if (!featuredItem) return null;

  return (
    <section>
      <FeaturedCard item={featuredItem} queue={feedTrackQueue} />
    </section>
  );
});

const FallbackShelf = React.memo(function FallbackShelf() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  // If user has any likes or followings, they're not a new user — no fallback needed
  const hasActivity = (user?.public_favorites_count ?? 0) > 0 || (user?.followings_count ?? 0) > 0;

  const { data: fallbackData, isLoading: fallbackLoading } = useFallbackTracks();
  const fallbackTracks = useMemo(() => fallbackData?.collection ?? [], [fallbackData]);

  if (hasActivity || (!fallbackLoading && fallbackTracks.length === 0)) return null;

  return (
    <section>
      <SectionHeader
        title={t('home.startListening', 'Start Listening')}
        icon={<Headphones size={15} className="text-accent" />}
      />
      <HorizontalScroll>
        {fallbackLoading ? (
          <ShelfSkeleton count={3} />
        ) : (
          fallbackTracks.map((track) => (
            <div key={track.urn} className="w-[180px] shrink-0">
              <TrackCard track={track} queue={fallbackTracks} />
            </div>
          ))
        )}
      </HorizontalScroll>
    </section>
  );
});

const LikedShelf = React.memo(function LikedShelf({
  likedTracks,
  isLoading,
}: {
  likedTracks: Track[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isLoading && likedTracks.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title={t('library.likedTracks')}
        icon={<Heart size={15} className="text-accent" />}
        onSeeAll={() => navigate('/library')}
      />
      <HorizontalScroll>
        {isLoading ? (
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
  );
});

const FollowingShelf = React.memo(function FollowingShelf({
  followingTracks,
  isLoading,
}: {
  followingTracks: Track[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();

  if (!isLoading && followingTracks.length === 0) return null;

  return (
    <section>
      <SectionHeader
        title={t('home.freshReleases')}
        icon={<Music size={15} className="text-white/50" />}
      />
      <HorizontalScroll>
        {isLoading ? (
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
  );
});

const DiscoverSection = React.memo(function DiscoverSection({
  likedTracks,
}: {
  likedTracks: Track[];
}) {
  const { t } = useTranslation();
  const { data: pool, isLoading } = useRelatedPool(likedTracks);

  // ── Recommended ──
  const recommendedTracks = useRecommendedTracks(pool, 40);

  // ── Discover by genre ──
  const discoverData = useDiscoverData(pool, likedTracks);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const genres = useMemo(() => discoverData.map((d) => d.genre), [discoverData]);
  const selectedGenre =
    activeGenre && genres.includes(activeGenre) ? activeGenre : (genres[0] ?? null);
  const genreTracks = useMemo(
    () => discoverData.find((d) => d.genre === selectedGenre)?.tracks ?? [],
    [discoverData, selectedGenre],
  );

  return (
    <>
      {/* Recommended For You */}
      {(isLoading || recommendedTracks.length > 0) && (
        <section>
          <SectionHeader
            title={t('home.recommended', 'Recommended For You')}
            icon={<Sparkles size={15} className="text-amber-400/70" />}
          />
          <HorizontalScroll>
            {isLoading ? (
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

      {/* Discover by genre */}
      {(isLoading || genres.length > 0) && (
        <section>
          <SectionHeader
            title={t('home.discover', 'Discover')}
            icon={<Compass size={15} className="text-cyan-400/70" />}
          />
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            {genres.map((g) => (
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
            {isLoading ? (
              <ShelfSkeleton />
            ) : (
              genreTracks.map((track) => (
                <div key={track.urn} className="w-[180px] shrink-0">
                  <TrackCard track={track} queue={genreTracks} />
                </div>
              ))
            )}
          </HorizontalScroll>
        </section>
      )}
    </>
  );
});

const FeedStream = React.memo(function FeedStream({
  feedItems,
  featuredItem,
  feedTrackQueue,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
}: {
  feedItems: FeedItem[];
  featuredItem: FeedItem | undefined;
  feedTrackQueue: Track[];
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const sentinelRef = useInfiniteScroll(hasNextPage, isFetchingNextPage, fetchNextPage);

  const streamItems = useMemo(
    () => feedItems.filter((i) => i !== featuredItem),
    [feedItems, featuredItem],
  );

  return (
    <section>
      <SectionHeader
        title={t('home.yourFeed')}
        icon={<Music size={15} className="text-white/50" />}
      />

      {isLoading ? (
        <FeedSkeleton />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-2.5">
          {streamItems.map((item) => (
            <div
              key={item.origin.urn}
              style={{
                contentVisibility: 'auto',
                contain: 'layout paint style',
                containIntrinsicSize: '380px 110px',
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
        {!isLoading && !hasNextPage && !isFetchingNextPage && streamItems.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-white/15">
            <div className="h-px w-8 bg-white/[0.06]" />
            <span>{t('home.endOfFeed')}</span>
            <div className="h-px w-8 bg-white/[0.06]" />
          </div>
        )}
      </div>
    </section>
  );
});

/* ── Home Page ────────────────────────────────────────────── */

export function Home() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const feedQuery = useFeed();
  const likedTracksQuery = useLikedTracks(100);
  const followingQuery = useFollowingTracks(20);

  const featuredItem = useMemo(
    () => feedQuery.items.find((item) => item.type.includes('track')),
    [feedQuery.items],
  );
  const feedTrackQueue = useMemo(
    () =>
      feedQuery.items
        .filter((item) => item.type.includes('track'))
        .map((item) => item.origin as Track),
    [feedQuery.items],
  );
  const followingTracks = useMemo(
    () => followingQuery.data?.collection ?? [],
    [followingQuery.data],
  );
  const likedShelfTracks = useMemo(
    () => likedTracksQuery.tracks.slice(0, 50),
    [likedTracksQuery.tracks],
  );

  return (
    <div className="p-6 pb-4 space-y-8">
      {/* Hero Greeting — no data hooks, won't re-render */}
      <section className="pt-1">
        <h1 className="hero-greeting text-3xl font-bold tracking-tight leading-tight pb-1">
          {t(greetingKey())}
          {user?.username ? `, ${user.username}` : ''}
        </h1>
        <div className="mt-3 h-px bg-gradient-to-r from-white/[0.06] via-white/[0.03] to-transparent" />
      </section>

      {/* Each section is isolated — own hooks, own re-render boundary */}
      <FeaturedHero
        featuredItem={featuredItem}
        feedTrackQueue={feedTrackQueue}
        isLoading={feedQuery.isLoading}
      />
      <FallbackShelf />
      <LikedShelf likedTracks={likedShelfTracks} isLoading={likedTracksQuery.isLoading} />
      <FollowingShelf followingTracks={followingTracks} isLoading={followingQuery.isLoading} />
      <DiscoverSection likedTracks={likedTracksQuery.tracks} />
      <FeedStream
        feedItems={feedQuery.items}
        featuredItem={featuredItem}
        feedTrackQueue={feedTrackQueue}
        fetchNextPage={feedQuery.fetchNextPage}
        hasNextPage={feedQuery.hasNextPage}
        isFetchingNextPage={feedQuery.isFetchingNextPage}
        isLoading={feedQuery.isLoading}
      />
    </div>
  );
}
