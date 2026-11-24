import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useHistory,
  useLikedTracks,
  useMyFollowings,
  useMyLikedPlaylists,
} from '../../../../lib/hooks';
import {
  armLikesContinuation,
  armSuperlikesContinuation,
} from '../../../../lib/queue-continuation';
import { useWarmSuperlikedTracks } from '../../../../lib/superlikes';
import type { Track } from '../../../../stores/player';
import { useSettingsStore } from '../../../../stores/settings';
import { historyEntryToTrack } from '../../../library/history-utils';
import { ArtistPanel } from './ArtistPanel';
import { PlaylistPanel } from './PlaylistPanel';
import { ReleasePanel } from './ReleasePanel';
import { feedOf, ShelfPlaceholder } from './ShelfPlaceholder';
import { ShelfTabs } from './ShelfTabs';
import { TrackPanel } from './TrackPanel';

const PAGE = 60;
const LIKED_PAGE = 100;

function Body() {
  const { t } = useTranslation();
  const tab = useSettingsStore((s) => s.homeShelfTab);
  const liked = useLikedTracks(LIKED_PAGE);
  const superliked = useWarmSuperlikedTracks(tab === 'superliked');
  const artists = useMyFollowings(PAGE, tab === 'artists');
  const playlists = useMyLikedPlaylists(PAGE, tab === 'playlists');
  const history = useHistory(PAGE, tab === 'history');
  const played = useMemo(() => {
    const seen = new Set<string>();
    const out: Track[] = [];
    for (const entry of history.entries) {
      if (seen.has(entry.trackUrn)) continue;
      seen.add(entry.trackUrn);
      out.push(historyEntryToTrack(entry));
    }
    return out;
  }, [history.entries]);

  if (tab === 'liked') {
    const feed = feedOf(liked, liked.tracks.length);
    return liked.tracks.length > 0 ? (
      <TrackPanel
        key="liked"
        tracks={liked.tracks}
        removes="like"
        onPlay={armLikesContinuation}
        onEnd={feed.more}
      />
    ) : (
      <ShelfPlaceholder feed={feed} hint={t('flowRedesign.emptyLiked')} />
    );
  }
  if (tab === 'superliked') {
    const feed = feedOf(superliked, superliked.tracks.length);
    return superliked.tracks.length > 0 ? (
      <TrackPanel
        key="superliked"
        tracks={superliked.tracks}
        removes="superlike"
        onPlay={armSuperlikesContinuation}
        onEnd={feed.more}
      />
    ) : (
      <ShelfPlaceholder feed={feed} hint={t('flowRedesign.emptySuperliked')} />
    );
  }
  if (tab === 'releases') return <ReleasePanel />;
  if (tab === 'artists') {
    const feed = feedOf(artists, artists.users.length);
    return artists.users.length > 0 ? (
      <ArtistPanel users={artists.users} onEnd={feed.more} />
    ) : (
      <ShelfPlaceholder feed={feed} hint={t('flowRedesign.emptyArtists')} />
    );
  }
  if (tab === 'playlists') {
    const feed = feedOf(playlists, playlists.playlists.length);
    return playlists.playlists.length > 0 ? (
      <PlaylistPanel playlists={playlists.playlists} onEnd={feed.more} />
    ) : (
      <ShelfPlaceholder feed={feed} hint={t('flowRedesign.emptyPlaylists')} />
    );
  }
  const feed = feedOf(history, played.length);
  return played.length > 0 ? (
    <TrackPanel key="history" tracks={played} onEnd={feed.more} />
  ) : (
    <ShelfPlaceholder feed={feed} hint={t('flowRedesign.emptyHistory')} />
  );
}

export function HomeShelf() {
  const open = useSettingsStore((s) => s.homeShelfOpen);
  return (
    <section data-ui="home-shelf" className="flex flex-col gap-2.5">
      <ShelfTabs />
      {open && <Body />}
    </section>
  );
}
