import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useHistory,
  useLikedTracks,
  useMyFollowings,
  useMyLikedPlaylists,
} from '../../../../lib/hooks';
import { armLikesContinuation } from '../../../../lib/queue-continuation';
import type { Track } from '../../../../stores/player';
import { useSettingsStore } from '../../../../stores/settings';
import { historyEntryToTrack } from '../../../library/history-utils';
import { Skeleton } from '../../../ui/Skeleton';
import { SyncNotice } from '../../../ui/SyncNotice';
import { ArtistPanel } from './ArtistPanel';
import { PlaylistPanel } from './PlaylistPanel';
import { ShelfTabs } from './ShelfTabs';
import { TrackPanel } from './TrackPanel';

const PAGE = 60;
const LIKED_PAGE = 100;

interface Feed {
  loading: boolean;
  failed: boolean;
  empty: boolean;
  retry: () => void;
  more: () => void;
}

function feedOf(
  query: {
    isLoading: boolean;
    isError: boolean;
    refetch: () => unknown;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage: () => unknown;
  },
  count: number,
): Feed {
  return {
    loading: query.isLoading,
    failed: query.isError && count === 0,
    empty: !query.isLoading && !query.isError && count === 0,
    retry: () => void query.refetch(),
    more: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
  };
}

function Placeholder({ feed, hint }: { feed: Feed; hint: string }) {
  if (feed.failed) return <SyncNotice kind="failed" onRetry={feed.retry} />;
  if (feed.empty) return <p className="px-1 py-6 text-[12.5px] text-ink-40">{hint}</p>;
  return (
    <div className="flex gap-3 overflow-hidden px-0.5" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={`sk-${i}`} className="w-[148px] shrink-0">
          <Skeleton className="aspect-square w-full" rounded="lg" />
          <Skeleton className="mt-2.5 h-3.5 w-3/4" rounded="sm" />
        </div>
      ))}
    </div>
  );
}

function Body() {
  const { t } = useTranslation();
  const tab = useSettingsStore((s) => s.homeShelfTab);
  const liked = useLikedTracks(LIKED_PAGE);
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
        removable
        onPlay={armLikesContinuation}
        onEnd={feed.more}
      />
    ) : (
      <Placeholder feed={feed} hint={t('flowRedesign.emptyLiked')} />
    );
  }
  if (tab === 'artists') {
    const feed = feedOf(artists, artists.users.length);
    return artists.users.length > 0 ? (
      <ArtistPanel users={artists.users} onEnd={feed.more} />
    ) : (
      <Placeholder feed={feed} hint={t('flowRedesign.emptyArtists')} />
    );
  }
  if (tab === 'playlists') {
    const feed = feedOf(playlists, playlists.playlists.length);
    return playlists.playlists.length > 0 ? (
      <PlaylistPanel playlists={playlists.playlists} onEnd={feed.more} />
    ) : (
      <Placeholder feed={feed} hint={t('flowRedesign.emptyPlaylists')} />
    );
  }
  const feed = feedOf(history, played.length);
  return played.length > 0 ? (
    <TrackPanel key="history" tracks={played} onEnd={feed.more} />
  ) : (
    <Placeholder feed={feed} hint={t('flowRedesign.emptyHistory')} />
  );
}

export function HomeShelf() {
  const open = useSettingsStore((s) => s.homeShelfOpen);
  return (
    <section data-ui="home-shelf" className="flex flex-col gap-3">
      <ShelfTabs />
      {open && <Body />}
    </section>
  );
}
