import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ArtistMiniCard} from '../components/library/ArtistMiniCard';
import {CollectionRail} from '../components/library/CollectionRail';
import {ContinueRow} from '../components/library/ContinueRow';
import {FreshDrops} from '../components/library/FreshDrops';
import {LibraryFrame} from '../components/library/LibraryFrame';
import {SoundPrintMasthead} from '../components/library/SoundPrintMasthead';
import {StatsTeaser} from '../components/library/stats/StatsTeaser';
import {useSoundprint} from '../components/library/useSoundprint';
import {PlaylistCard} from '../components/music/PlaylistCard';
import {TrackCard} from '../components/music/TrackCard';
import {SyncNotice, syncNoticeOf} from '../components/ui/SyncNotice';
import {useLikedTracks, useMyFollowings, useMyLikedPlaylists, useMyPlaylists} from '../lib/hooks';
import {Bookmark, Heart, ListMusic, Users} from '../lib/icons';
import {likedTracksCount} from '../lib/likes';
import {armLikesContinuation} from '../lib/queue-continuation';
import {useAuthStore} from '../stores/auth';

/** Library "Hub" — a living home base. Your identity up top, then the reason to
 *  come back (fresh drops from who you follow), then a way back into what you
 *  were playing, then shelves into the deep pages of your collection. */
export const Library = React.memo(() => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const likesQuery = useLikedTracks();
  const likedTracks = likesQuery.tracks;
  // Picked genre tag — retints the whole hub and filters its genre-aware shelves.
  const [genre, setGenre] = useState<string | null>(null);
  const sound = useSoundprint(likedTracks, genre);

  const playlistsQuery = useMyPlaylists();
  const likedPlaylistsQuery = useMyLikedPlaylists();
  const followingsQuery = useMyFollowings();
  const { playlists } = playlistsQuery;
  const { playlists: likedPlaylists } = likedPlaylistsQuery;
  const { users: followings } = followingsQuery;

  const collections = [likesQuery, playlistsQuery, likedPlaylistsQuery, followingsQuery];
  const libraryEmpty = collections.every((query) => !query.isLoading && query.items.length === 0);
  const notice = collections.map(syncNoticeOf).find((kind) => kind !== null);
  const retryAll = () => {
    for (const query of collections) void query.refetch();
  };

  const playlistPreview = useMemo(() => {
    const base = genre ? playlists.filter((p) => p.genre?.trim() === genre) : playlists;
    return base.slice(0, 12);
  }, [playlists, genre]);
  const likedPlaylistPreview = useMemo(() => {
    const base = genre ? likedPlaylists.filter((p) => p.genre?.trim() === genre) : likedPlaylists;
    return base.slice(0, 12);
  }, [likedPlaylists, genre]);
  const artistPreview = useMemo(() => followings.slice(0, 14), [followings]);
  const likesPreview = useMemo(() => {
    const base = genre ? likedTracks.filter((tr) => tr.genre?.trim() === genre) : likedTracks;
    return base.slice(0, 12);
  }, [likedTracks, genre]);

  if (!user) return null;

  return (
    <LibraryFrame sound={sound}>
      <div className="space-y-9">
        <SoundPrintMasthead
          user={user}
          likedTracks={likedTracks}
          sound={sound}
          selected={genre}
          onSelect={setGenre}
        />

        {libraryEmpty && (
          <div className="py-6">
            {notice ? (
              <SyncNotice kind={notice} onRetry={retryAll} />
            ) : (
              <p className="text-center text-[13px] text-white/30">{t('common.empty')}</p>
            )}
          </div>
        )}

        <FreshDrops genre={genre} />

        <ContinueRow genre={genre} />

        <StatsTeaser aura={sound.aura} genre={genre} />

        {playlistPreview.length > 0 && (
          <CollectionRail
            icon={<ListMusic size={16} />}
            title={t('library.yourPlaylists')}
            count={user.playlist_count}
            to="/library/playlists"
          >
            {playlistPreview.map((p) => (
              <div key={p.urn} className="w-[160px] shrink-0">
                <PlaylistCard playlist={p} />
              </div>
            ))}
          </CollectionRail>
        )}

        {likedPlaylistPreview.length > 0 && (
          <CollectionRail
            icon={<Bookmark size={16} />}
            title={t('library.likedPlaylists')}
            to="/library/playlists"
          >
            {likedPlaylistPreview.map((p) => (
              <div key={p.urn} className="w-[160px] shrink-0">
                <PlaylistCard playlist={p} />
              </div>
            ))}
          </CollectionRail>
        )}

        {artistPreview.length > 0 && (
          <CollectionRail
            icon={<Users size={16} />}
            title={t('library.artists')}
            count={user.followings_count}
            to="/library/following"
          >
            {artistPreview.map((u) => (
              <ArtistMiniCard key={u.urn} user={u} />
            ))}
          </CollectionRail>
        )}

        {likesPreview.length > 0 && (
          <CollectionRail
            icon={<Heart size={16} />}
            title={t('library.likedTracks')}
            count={likedTracksCount(user)}
            to="/library/likes"
          >
            {likesPreview.map((tr) => (
              <div key={tr.urn} className="w-[150px] shrink-0">
                <TrackCard
                  track={tr}
                  queue={likesPreview}
                  onPlay={genre ? undefined : armLikesContinuation}
                />
              </div>
            ))}
          </CollectionRail>
        )}
      </div>
    </LibraryFrame>
  );
});
