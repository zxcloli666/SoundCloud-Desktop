import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { cancelPreload, preloadTrack } from '../../lib/audio';
import { ago, art, dur, fc } from '../../lib/formatters';
import { type FeedItem, type Playlist, type SCUser, useFeatured } from '../../lib/hooks';
import {
  ChevronRight,
  Headphones,
  Heart,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Play,
  Repeat2,
} from '../../lib/icons';
import { playlistCoverUrl } from '../../lib/playlist-cover';
import {
  getArtistTarget,
  useArtistDisplay,
  useArtistLinkItems,
  useDisplayTitle,
} from '../../lib/track-display';
import { useTrackPlay } from '../../lib/useTrackPlay';
import { type Track, usePlayerStore } from '../../stores/player';
import { ArtistNameLinks } from '../music/ArtistNameLinks';
import { TrackStatusBadges } from '../music/TrackStatusBadges';
import { UploadKindDot } from '../music/UploadKindDot';
import { Skeleton } from '../ui/Skeleton';

const CARD = 'panel relative flex items-center gap-6 p-5 select-none @min-[512px]:p-6';
const COVER =
  'relative h-[132px] w-[132px] shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-ink/[0.05] ring-1 ring-ink/[0.08] @min-[512px]:h-[160px] @min-[512px]:w-[160px]';

function PlayDisc({
  playing,
  loading = false,
  onClick,
}: {
  playing: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? t('track.pause') : t('track.play')}
      className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--disc-line) bg-(--disc) text-(--disc-ink) transition-[filter] hover:brightness-115"
    >
      {loading ? (
        <Loader2 size={20} className="animate-spin" />
      ) : playing ? (
        <Pause size={20} fill="currentColor" strokeWidth={0} />
      ) : (
        <Play size={20} fill="currentColor" strokeWidth={0} className="ml-0.5" />
      )}
    </button>
  );
}

function FeaturedSkeleton() {
  return (
    <div className={CARD}>
      <Skeleton className="h-[160px] w-[160px] shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-6 w-3/4" rounded="sm" />
        <Skeleton className="h-4 w-1/3" rounded="sm" />
        <div className="pt-3" />
        <Skeleton className="h-3 w-1/2" rounded="sm" />
      </div>
      <Skeleton className="h-14 w-14 shrink-0" rounded="full" />
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
        className="text-xl font-bold text-ink-95 truncate leading-tight cursor-pointer hover:text-ink transition-colors duration-200"
        onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
      >
        {displayTitle}
      </h2>
      <div className="flex items-center gap-2 mt-2 group/artist">
        {avatar && (
          <img
            src={avatar}
            alt=""
            className="w-5 h-5 rounded-full ring-1 ring-ink/[0.08] group-hover/artist:ring-ink/[0.15] transition-all duration-150 cursor-pointer"
            decoding="async"
            onClick={artistTarget ? () => navigate(artistTarget) : undefined}
          />
        )}
        <UploadKindDot kind={artistDisplay.uploadKind} />
        <p className="text-[13px] text-ink-40 truncate transition-colors duration-150">
          <ArtistNameLinks
            items={artistLinks}
            linkClassName="cursor-pointer transition-colors hover:text-ink-60"
          />
        </p>
      </div>
    </>
  );
});

const META = 'mt-4 flex flex-wrap items-center gap-3 text-[11px] tabular-nums text-ink-35';
const GENRE = 'rounded-full bg-ink/[0.06] px-2.5 py-1 text-[10.5px] font-medium text-ink-55';

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
      <div className={CARD} onMouseEnter={() => preloadTrack(track)} onMouseLeave={cancelPreload}>
        <div className={COVER} onClick={togglePlay}>
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" decoding="async" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music size={40} className="text-ink-20" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex">
            <TrackStatusBadges meta={track._scd_meta} videos={track.videos} variant="overlay" />
          </div>
        </div>

        <div className="min-w-0 flex-1 py-1">
          {isRepost && (
            <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-35">
              <Repeat2 size={11} />
              <span>{t('home.reposted')}</span>
              <span className="text-ink-20">·</span>
              <span>{ago(item.created_at)}</span>
            </div>
          )}
          <FeaturedTitleArtist track={track} avatar={avatar} navigate={navigate} />
          <div className={META}>
            {track.genre && <span className={GENRE}>{track.genre}</span>}
            <span className="flex items-center gap-1">
              <Headphones size={11} />
              {fc(track.playback_count)}
            </span>
            <span className="flex items-center gap-1">
              <Heart size={11} />
              {fc(track.favoritings_count ?? track.likes_count)}
            </span>
            <span>{dur(track.duration)}</span>
            {!isRepost && item.created_at && <span>{ago(item.created_at)}</span>}
          </div>
        </div>

        <PlayDisc playing={isThisPlaying} onClick={togglePlay} />
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
    <div className={CARD}>
      <div className={COVER} onClick={handlePlay}>
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" decoding="async" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ListMusic size={40} className="text-ink-20" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 py-1">
        <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-35">
          <ListMusic size={11} />
          <span>{t('search.playlists')}</span>
        </div>
        <h2
          className="cursor-pointer truncate text-xl leading-tight font-bold text-ink-95 transition-colors duration-200 hover:text-ink"
          onClick={() => navigate(`/playlist/${encodeURIComponent(playlist.urn)}`)}
        >
          {playlist.title}
        </h2>
        {playlist.user && (
          <div
            className="group/artist mt-2 flex cursor-pointer items-center gap-2"
            onClick={() => navigate(`/user/${encodeURIComponent(playlist.user.urn)}`)}
          >
            {playlist.user.avatar_url && (
              <img
                src={art(playlist.user.avatar_url, 'small') ?? ''}
                alt=""
                className="h-5 w-5 rounded-full ring-1 ring-ink/[0.08] transition-all duration-150 group-hover/artist:ring-ink/[0.15]"
                decoding="async"
              />
            )}
            <p className="truncate text-[13px] text-ink-45 transition-colors duration-150 group-hover/artist:text-ink-70">
              {playlist.user.username}
            </p>
          </div>
        )}
        <div className={META}>
          {playlist.genre && <span className={GENRE}>{playlist.genre}</span>}
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

      <PlayDisc playing={isPlayingFromThis} loading={loading} onClick={handlePlay} />
    </div>
  );
});

const FeaturedUserHero = React.memo(function FeaturedUserHero({ user }: { user: SCUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const avatar = art(user.avatar_url);

  return (
    <div
      className={`${CARD} group cursor-pointer transition-colors hover:border-ink/[0.14]`}
      onClick={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
    >
      <div className="h-[132px] w-[132px] shrink-0 overflow-hidden rounded-full bg-ink/[0.05] ring-1 ring-ink/[0.08] @min-[512px]:h-[160px] @min-[512px]:w-[160px]">
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" decoding="async" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music size={40} className="text-ink-20" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 py-1">
        <h2 className="truncate text-xl leading-tight font-bold text-ink-95 transition-colors duration-200 group-hover:text-ink">
          {user.username}
        </h2>
        {(user.city || user.country_code) && (
          <p className="mt-1.5 text-[13px] text-ink-40">
            {[user.city, user.country_code].filter(Boolean).join(', ')}
          </p>
        )}
        <div className={META}>
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
        size={24}
        className="shrink-0 text-ink-25 transition-colors group-hover:text-ink-50"
      />
    </div>
  );
});

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
