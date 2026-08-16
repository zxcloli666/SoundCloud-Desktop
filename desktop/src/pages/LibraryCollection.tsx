import React, { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { FollowingTab } from '../components/library/FollowingTab';
import { HistoryTab } from '../components/library/HistoryTab';
import { LibraryFrame } from '../components/library/LibraryFrame';
import { LibrarySubHeader } from '../components/library/LibrarySubHeader';
import type { LibraryTab } from '../components/library/LibraryTabs';
import { LikesTab } from '../components/library/LikesTab';
import { PlaylistsTab } from '../components/library/PlaylistsTab';
import { likedTracksCount } from '../lib/likes';
import { useAuthStore } from '../stores/auth';

type Section = 'likes' | 'playlists' | 'following' | 'history';
const SECTIONS: Section[] = ['likes', 'playlists', 'following', 'history'];

const ACTIVE_TAB: Partial<Record<Section, LibraryTab>> = {
  likes: 'tracks',
  playlists: 'playlists',
  following: 'artists',
};

/** A deep collection page (/library/:section) — the full, filterable, virtualized
 *  view that the hub's rails link into. */
export const LibraryCollection = React.memo(() => {
  const { t } = useTranslation();
  const { section } = useParams<{ section: string }>();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState('');
  const deferredFilter = useDeferredValue(filter);

  if (!user) return null;
  if (!section || !SECTIONS.includes(section as Section)) {
    return <Navigate to="/library" replace />;
  }
  const sec = section as Section;

  const count =
    sec === 'likes'
      ? likedTracksCount(user)
      : sec === 'playlists'
        ? user.playlist_count
        : sec === 'following'
          ? user.followings_count
          : undefined;

  return (
    <LibraryFrame>
      <LibrarySubHeader
        title={sec === 'history' ? t('library.history') : t('library.yourMusic')}
        activeTab={ACTIVE_TAB[sec]}
        count={count}
        filter={sec === 'history' ? undefined : filter}
        onFilter={sec === 'history' ? undefined : setFilter}
      />

      {sec === 'likes' && <LikesTab filter={deferredFilter} />}
      {sec === 'playlists' && <PlaylistsTab filter={deferredFilter} />}
      {sec === 'following' && <FollowingTab filter={deferredFilter} />}
      {sec === 'history' && <HistoryTab />}
    </LibraryFrame>
  );
});
