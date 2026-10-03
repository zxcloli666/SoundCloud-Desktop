import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {useShallow} from 'zustand/shallow';
import {cancelPreload, preloadTrack} from '../../lib/audio';
import {ago, art, dur, fc} from '../../lib/formatters';
import {type FeedItem, type Playlist, type SCUser, useFeatured} from '../../lib/hooks';
import {
  ChevronRight,
  Headphones,
  Heart,
  ListMusic,
  Loader2,
  Music,
  pauseBlack18,
  pauseBlack22,
  playBlack18,
  playBlack22,
  Repeat2,
} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import {playlistCoverUrl} from '../../lib/playlist-cover';
import {getArtistTarget, useArtistDisplay, useArtistLinkItems, useDisplayTitle,} from '../../lib/track-display';
import {useAutoHide} from '../../lib/useAutoHide';
import {useTrackPlay} from '../../lib/useTrackPlay';
import {type Track, usePlayerStore} from '../../stores/player';
import {ArtistNameLinks} from '../music/ArtistNameLinks';
import {TrackStatusBadges} from '../music/TrackStatusBadges';
import {UploadKindDot} from '../music/UploadKindDot';
import {Skeleton} from '../ui/Skeleton';

/* Blurred artwork backdrop for the promo hero; flat tint when blur is gated off. */
const HeroBlurBg = React.memo(function HeroBlurBg({ cover }: { cover: string }) {
  const b = usePerfMode().blur(80);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {b > 0 && (
        <img
          src={cover}
          alt=""
          className="w-full h-full object-cover scale-[1.4] opacity-20"
          decoding="async"
          style={{ filter: `blur(${b}px) saturate(1.5)` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[rgb(8,8,10)]/70 via-[rgb(8,8,10)]/50 to-[rgb(8,8,10)]/70" />
    </div>
  );
});

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

const FeaturedTitleArtist = React.memo(function FeaturedTitleArtist({
  track,
  avatar,
  navigate,
}: {
  track: Track;
  avatar: string | null;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const artistDisplay = useArtistDisplay(track);
  const displayTitle = useDisplayTitle(track);
  const artistLinks = useArtistLinkItems(track);
  const artistTarget = getArtistTarget(track);
  return (
    <>
      <h2
        className="text-xl font-bold text-white/95 truncate leading-tight cursor-pointer hover:text-white transition-colors duration-200"
        onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
      >
        {displayTitle}
      </h2>
      <div className="flex items-center gap-2 mt-2 group/artist">
        {avatar && (
          <img
            src={avatar}
            alt=""
            className="w-5 h-5 rounded-full ring-1 ring-white/[0.08] group-hover/artist:ring-white/[0.15] transition-all duration-150 cursor-pointer"
            decoding="async"
            onClick={artistTarget ? () => navigate(artistTarget) : undefined}
          />
        )}
        <UploadKindDot kind={artistDisplay.uploadKind} />
        <p className="text-[13px] text-white/40 truncate transition-colors duration-150">
          <ArtistNameLinks
            items={artistLinks}
            linkClassName="cursor-pointer transition-colors hover:text-white/60"
          />
        </p>
      </div>
    </>
  );
});

const FeaturedCard = React.memo(
  function FeaturedCard({ item, queue }: { item: FeedItem; queue: Track[] }) {
    const { t } = useTranslation();
    const track = item.origin as Track;
    const { isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const showPlayingOverlay = useAutoHide(isThisPlaying);
    const navigate = useNavigate();
    const isRepost = item.type.includes('repost');
    const cover = art(track.artwork_url);
    const avatar = art(track.user.avatar_url, 'small');

    return (
      <div
        className="relative rounded-3xl overflow-hidden group glass-featured select-none"
        onMouseEnter={() => preloadTrack(track.urn)}
        onMouseLeave={cancelPreload}
      >
        {cover && <HeroBlurBg cover={cover} />}
        <div className="relative flex items-center gap-6 p-6">
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
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                <Music size={40} className="text-white/15" />
              </div>
            )}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-all duration-300 group-hover/cover:bg-black/30 group-hover/cover:opacity-100 ${
                showPlayingOverlay ? 'bg-black/30 opacity-100' : 'bg-black/0 opacity-0'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ease-[var(--ease-apple)] group-hover/cover:scale-100 ${
                  showPlayingOverlay ? 'bg-white scale-100' : 'bg-white/90 scale-75'
                }`}
              >
                {isThisPlaying ? pauseBlack18 : playBlack18}
              </div>
            </div>
            <div className="absolute bottom-2 left-2 flex">
              <TrackStatusBadges meta={track._scd_meta} variant="overlay" />
            </div>
          </div>

          <div className="flex-1 min-w-0 py-1">
            {isRepost && (
              <div className="flex items-center gap-1.5 mb-2.5 text-[11px] text-white/30 font-medium">
                <Repeat2 size={11} />
                <span>{t('home.reposted')}</span>
                <span className="text-white/15">·</span>
                <span>{ago(item.created_at)}</span>
              </div>
            )}
            <FeaturedTitleArtist track={track} avatar={avatar} navigate={navigate} />
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

const FeaturedPlaylistHero = React.memo(function FeaturedPlaylistHero({
  playlist,
}: {
  playlist: Playlist;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const trackUrns = useMemo(
    () => new Set((playlist.tracks ?? []).map((tr: Track) => tr.urn)),
    [playlist.tracks],
  );
  const { isPausedFromThis, isPlayingFromThis } = usePlayerStore(
    useShallow((s) => ({
      isPlayingFromThis: s.isPlaying && s.currentTrack != null && trackUrns.has(s.currentTrack.urn),
      isPausedFromThis: !s.isPlaying && s.currentTrack != null && trackUrns.has(s.currentTrack.urn),
    })),
  );
  const cover = playlistCoverUrl(playlist.artwork_url, playlist.tracks);

  const handlePlay = async () => {
    const { play, pause, resume } = usePlayerStore.getState();
    if (isPlayingFromThis) return pause();
    if (isPausedFromThis) return resume();
    if (playlist.tracks && playlist.tracks.length > 0) {
      play(playlist.tracks[0], playlist.tracks);
      return;
    }
    setLoading(true);
    try {
      const data = await import('../../lib/api').then((m) =>
        m.api<{ collection: Track[] }>(`/playlists/${encodeURIComponent(playlist.urn)}/tracks`),
      );
      if (data.collection.length > 0) {
        usePlayerStore.getState().play(data.collection[0], data.collection);
      }
    } catch {
      navigate(`/playlist/${encodeURIComponent(playlist.urn)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative rounded-3xl overflow-hidden group glass-featured select-none">
      {cover && <HeroBlurBg cover={cover} />}
      <div className="relative flex items-center gap-6 p-6">
        <div
          className="relative w-[160px] h-[160px] rounded-2xl overflow-hidden shrink-0 shadow-2xl ring-1 ring-white/[0.1] cursor-pointer group/cover"
          onClick={handlePlay}
        >
          {cover ? (
            <img
              src={cover}
              alt={playlist.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover/cover:scale-[1.05]"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
              <ListMusic size={40} className="text-white/15" />
            </div>
          )}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isPlayingFromThis ? 'bg-black/30 opacity-100' : 'bg-black/0 opacity-0 group-hover/cover:bg-black/30 group-hover/cover:opacity-100'}`}
          >
            {loading ? (
              <Loader2 size={24} className="text-white animate-spin" />
            ) : (
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ease-[var(--ease-apple)] ${isPlayingFromThis ? 'bg-white scale-100' : 'bg-white/90 scale-75 group-hover/cover:scale-100'}`}
              >
                {isPlayingFromThis ? pauseBlack18 : playBlack18}
              </div>
            )}
          </div>
          {playlist.track_count != null && (
            <div className="absolute bottom-2 right-2 flex items-center gap-0.5 text-[10px] font-medium bg-black/50 backdrop-blur-md text-white/70 px-2 py-0.5 rounded-full">
              <ListMusic size={10} />
              {playlist.track_count}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-1.5 mb-2.5 text-[11px] text-white/30 font-medium">
            <ListMusic size={11} />
            <span>{t('search.playlists')}</span>
          </div>
          <h2
            className="text-xl font-bold text-white/95 truncate leading-tight cursor-pointer hover:text-white transition-colors duration-200"
            onClick={() => navigate(`/playlist/${encodeURIComponent(playlist.urn)}`)}
          >
            {playlist.title}
          </h2>
          {playlist.user && (
            <div
              className="flex items-center gap-2 mt-2 cursor-pointer group/artist"
              onClick={() => navigate(`/user/${encodeURIComponent(playlist.user.urn)}`)}
            >
              {playlist.user.avatar_url && (
                <img
                  src={art(playlist.user.avatar_url, 'small') ?? ''}
                  alt=""
                  className="w-5 h-5 rounded-full ring-1 ring-white/[0.08] group-hover/artist:ring-white/[0.15] transition-all duration-150"
                  decoding="async"
                />
              )}
              <p className="text-[13px] text-white/40 truncate group-hover/artist:text-white/60 transition-colors duration-150">
                {playlist.user.username}
              </p>
            </div>
          )}
          <div className="flex items-center gap-3 mt-4 text-[11px] text-white/25 tabular-nums">
            {playlist.genre && (
              <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/[0.06] text-white/45 border border-white/[0.06]">
                {playlist.genre}
              </span>
            )}
            <span className="flex items-center gap-1">
              <ListMusic size={11} />
              {playlist.track_count ?? 0} {t('search.tracks').toLowerCase()}
            </span>
            <span className="flex items-center gap-1">
              <Heart size={11} />
              {fc(playlist.likes_count)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePlay}
          className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ease-[var(--ease-apple)] shadow-xl cursor-pointer ${isPlayingFromThis ? 'bg-white scale-100' : 'bg-white/90 hover:bg-white hover:scale-105 active:scale-95'}`}
        >
          {loading ? (
            <Loader2 size={22} className="text-black animate-spin" />
          ) : isPlayingFromThis ? (
            pauseBlack22
          ) : (
            playBlack22
          )}
        </button>
      </div>
    </div>
  );
});

const FeaturedUserHero = React.memo(function FeaturedUserHero({ user }: { user: SCUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const avatar = art(user.avatar_url);

  return (
    <div
      className="relative rounded-3xl overflow-hidden group glass-featured select-none cursor-pointer"
      onClick={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
    >
      {avatar && <HeroBlurBg cover={avatar} />}
      <div className="relative flex items-center gap-6 p-6">
        <div className="w-[160px] h-[160px] rounded-full overflow-hidden shrink-0 shadow-2xl ring-1 ring-white/[0.1]">
          {avatar ? (
            <img
              src={avatar}
              alt={user.username}
              className="w-full h-full object-cover"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
              <Music size={40} className="text-white/15" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 py-1">
          <h2 className="text-xl font-bold text-white/95 truncate leading-tight group-hover:text-white transition-colors duration-200">
            {user.username}
          </h2>
          {(user.city || user.country) && (
            <p className="text-[13px] text-white/30 mt-1.5">
              {[user.city, user.country].filter(Boolean).join(', ')}
            </p>
          )}
          <div className="flex items-center gap-4 mt-4 text-[11px] text-white/25 tabular-nums">
            {user.followers_count != null && (
              <span>
                {fc(user.followers_count)} {t('user.followers')}
              </span>
            )}
            {user.track_count != null && (
              <span>
                {fc(user.track_count)} {t('search.tracks').toLowerCase()}
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          size={28}
          className="text-white/20 shrink-0 group-hover:text-white/40 transition-colors"
        />
      </div>
    </div>
  );
});

/** Admin-pinned promo (track / playlist / user) — the editorial "featured" slot,
 *  rehomed from the old Home onto Discover. Renders nothing when no pin is set. */
export const FeaturedHero = React.memo(function FeaturedHero() {
  const { data: featured, isLoading } = useFeatured();
  if (isLoading) return <FeaturedSkeleton />;
  if (!featured) return null;

  switch (featured.type) {
    case 'track':
      return (
        <FeaturedCard
          item={{ type: 'track', created_at: '', origin: featured.data as Track } as FeedItem}
          queue={[featured.data as Track]}
        />
      );
    case 'playlist':
      return <FeaturedPlaylistHero playlist={featured.data as Playlist} />;
    case 'user':
      return <FeaturedUserHero user={featured.data as SCUser} />;
    default:
      return null;
  }
});
