import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LibraryAlbumsTab } from '../components/library/LibraryAlbumsTab';
import { LibraryFrame } from '../components/library/LibraryFrame';
import { LibrarySubHeader } from '../components/library/LibrarySubHeader';
import { type Playlist, useLikedTracks, useMyLikedPlaylists, useMyPlaylists } from '../lib/hooks';
import { useAuthStore } from '../stores/auth';

export const Library = React.memo(() => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const likedTracksQuery = useLikedTracks();
  const ownPlaylistsQuery = useMyPlaylists();
  const likedPlaylistsQuery = useMyLikedPlaylists();
  const likedTracks = likedTracksQuery.tracks;
  const ownPlaylists = ownPlaylistsQuery.playlists;
  const likedPlaylists = likedPlaylistsQuery.playlists;

  const playlists = useMemo(() => {
    const unique = new Map<string, Playlist>();
    for (const playlist of [...ownPlaylists, ...likedPlaylists]) {
      unique.set(playlist.urn, playlist);
    }
    return Array.from(unique.values());
  }, [likedPlaylists, ownPlaylists]);

  if (!user) return null;

  return (
    <LibraryFrame>
      <LibrarySubHeader title={t('library.yourMusic')} activeTab="albums" />
      <LibraryAlbumsTab
        tracks={likedTracks}
        playlists={playlists}
        loading={
          likedTracksQuery.isLoading || ownPlaylistsQuery.isLoading || likedPlaylistsQuery.isLoading
        }
      />
    </LibraryFrame>
  );
});
