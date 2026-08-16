import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { preloadTrack } from '../../lib/audio';
import { art, dur } from '../../lib/formatters';
import type { Playlist } from '../../lib/hooks';
import { Disc3, ListPlus, Loader2, Music, Play, pauseWhite14, playWhite14 } from '../../lib/icons';
import { getArtistDisplay, getDisplayTitle } from '../../lib/track-display';
import { useTrackPlay } from '../../lib/useTrackPlay';
import type { Track } from '../../stores/player';
import { usePlayerStore } from '../../stores/player';
import { LikeButton } from '../music/LikeButton';

interface LibraryAlbumEntry {
  key: string;
  title: string;
  artist: string;
  year?: number;
  coverUrl: string | null;
  href: string;
  tracks: Track[];
}

function collectAlbums(tracks: Track[], playlists: Playlist[]): LibraryAlbumEntry[] {
  const entries = new Map<string, LibraryAlbumEntry>();

  for (const track of tracks) {
    const album = track.enrichment?.album;
    const key = album?.id ? `album:${album.id}` : `single:${track.urn}`;
    const existing = entries.get(key);
    if (existing) {
      existing.tracks.push(track);
      continue;
    }

    entries.set(key, {
      key,
      title: album?.title || getDisplayTitle(track),
      artist: album?.primary_artist?.name || getArtistDisplay(track).primary,
      year: album?.year || track.enrichment?.release_year || track.release_year,
      coverUrl: album?.cover_url || track.artwork_url,
      href: album?.id
        ? `/album/${encodeURIComponent(album.id)}`
        : `/track/${encodeURIComponent(track.urn)}`,
      tracks: [track],
    });
  }

  for (const playlist of playlists) {
    const kind = `${playlist.kind || ''} ${playlist.playlist_type || ''}`.toLowerCase();
    if (!/(album|ep|single|compilation)/.test(kind)) continue;

    const key = `playlist:${playlist.urn}`;
    if (entries.has(key)) continue;
    entries.set(key, {
      key,
      title: playlist.title,
      artist: playlist.user.username,
      year: playlist.release_year,
      coverUrl: playlist.artwork_url || playlist.tracks?.[0]?.artwork_url || null,
      href: `/playlist/${encodeURIComponent(playlist.urn)}`,
      tracks: playlist.tracks || [],
    });
  }

  return Array.from(entries.values());
}

const AlbumCard = memo(function AlbumCard({ album }: { album: LibraryAlbumEntry }) {
  const navigate = useNavigate();
  const cover = art(album.coverUrl, 't500x500');

  return (
    <button type="button" className="sonveil-album-card" onClick={() => navigate(album.href)}>
      <span className="sonveil-album-card-art">
        {cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="sonveil-art-fallback">
            <Disc3 size={24} />
          </span>
        )}
      </span>
      <span className="sonveil-album-card-copy">
        <b>{album.title}</b>
        <small>{album.artist}</small>
      </span>
    </button>
  );
});

const RecentTrackRow = memo(function RecentTrackRow({
  track,
  queue,
}: {
  track: Track;
  queue: Track[];
}) {
  const navigate = useNavigate();
  const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
  const cover = art(track.enrichment?.album?.cover_url || track.artwork_url, 't200x200');

  return (
    <div className={`sonveil-library-track-row${isThis ? ' is-current' : ''}`}>
      <button
        type="button"
        className="sonveil-library-track-play"
        onClick={togglePlay}
        onMouseEnter={() => preloadTrack(track.urn)}
      >
        {cover ? <img src={cover} alt="" decoding="async" /> : <Music size={15} />}
        <span>{isThisPlaying ? pauseWhite14 : playWhite14}</span>
      </button>
      <button
        type="button"
        className="sonveil-library-track-title"
        onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
      >
        <b>{getDisplayTitle(track)}</b>
        <small>{getArtistDisplay(track).primary}</small>
      </button>
      <span className="sonveil-library-track-album">{track.enrichment?.album?.title || '—'}</span>
      <LikeButton track={track} />
      <time>{dur(track.duration)}</time>
    </div>
  );
});

export const LibraryAlbumsTab = memo(function LibraryAlbumsTab({
  tracks,
  playlists,
  loading,
}: {
  tracks: Track[];
  playlists: Playlist[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const albums = useMemo(() => collectAlbums(tracks, playlists), [playlists, tracks]);
  const featured = albums[0];
  const recentTracks = tracks.slice(0, 6);

  if (loading) {
    return (
      <div className="sonveil-library-empty" aria-label={t('common.loading')}>
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (!featured) {
    return <div className="sonveil-library-empty">{t('library.noAlbums')}</div>;
  }

  const totalDuration = featured.tracks.reduce((total, track) => total + track.duration, 0);
  const featuredCover = art(featured.coverUrl, 't500x500');
  const trackCount = t('library.trackCount', { count: featured.tracks.length });

  const playFeatured = () => {
    if (featured.tracks.length > 0) {
      usePlayerStore.getState().play(featured.tracks[0], featured.tracks);
    } else {
      navigate(featured.href);
    }
  };

  const queueFeatured = () => {
    if (featured.tracks.length > 0) {
      usePlayerStore.getState().addToQueueNext(featured.tracks);
    }
  };

  return (
    <div className="sonveil-library-albums">
      <section className="sonveil-library-featured" aria-labelledby="library-featured-title">
        <button
          type="button"
          className="sonveil-library-featured-art"
          onClick={() => navigate(featured.href)}
        >
          {featuredCover ? (
            <img src={featuredCover} alt="" decoding="async" />
          ) : (
            <span className="sonveil-art-fallback">
              <Disc3 size={32} />
            </span>
          )}
        </button>

        <div className="sonveil-library-featured-copy">
          <span>{t('library.featuredAlbum')}</span>
          <button type="button" onClick={() => navigate(featured.href)}>
            <h2 id="library-featured-title">{featured.title}</h2>
          </button>
          <p>{featured.artist}</p>
          <small>
            {[featured.year, trackCount, totalDuration > 0 ? dur(totalDuration) : null]
              .filter(Boolean)
              .join(' · ')}
          </small>
          <div className="sonveil-library-featured-actions">
            <button type="button" className="is-primary" onClick={playFeatured}>
              <Play size={16} fill="currentColor" />
              {t('library.playAlbum')}
            </button>
            {featured.tracks[0] ? (
              <LikeButton track={featured.tracks[0]} variant="editorial" />
            ) : null}
            {featured.tracks.length > 0 ? (
              <button
                type="button"
                onClick={queueFeatured}
                title={t('player.addToQueue')}
                aria-label={t('player.addToQueue')}
              >
                <ListPlus size={17} />
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {albums.length > 1 ? (
        <section className="sonveil-album-grid" aria-label={t('search.albums')}>
          {albums.slice(1, 25).map((album) => (
            <AlbumCard key={album.key} album={album} />
          ))}
        </section>
      ) : null}

      {recentTracks.length > 0 ? (
        <section className="sonveil-library-recent" aria-labelledby="library-recent-title">
          <h2 id="library-recent-title">{t('library.recentTracks')}</h2>
          <div>
            {recentTracks.map((track) => (
              <RecentTrackRow key={track.urn} track={track} queue={recentTracks} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
});
