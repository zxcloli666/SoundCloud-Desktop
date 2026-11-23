import { useCallback, useMemo } from 'react';
import { HomeShelf } from '../components/home/flow/shelf/HomeShelf';
import { type ArchiveShelf, ArchiveStation } from '../components/home/river/ArchiveStation';
import { MomentsShelf } from '../components/home/river/MomentsShelf';
import { RiverFlow } from '../components/home/river/RiverFlow';
import { useLayoutMenu } from '../components/layout/LayoutMenu';
import { SoundWaveLockOverlay } from '../components/music/soundwave';
import { ReleasesShelf } from '../components/releases/ReleasesShelf';
import { useLikedTracks } from '../lib/hooks';
import type { LayoutId } from '../lib/layout';
import { useVisibleBlocks } from '../lib/use-layout';
import { useAuthStore } from '../stores/auth';

type HomeGroup =
  | { kind: 'river' }
  | { kind: 'moments' }
  | { kind: 'shelf' }
  | { kind: 'releases' }
  | { kind: 'archive'; shelves: ArchiveShelf[] };

function groupBlocks(blocks: LayoutId<'home'>[]): HomeGroup[] {
  const groups: HomeGroup[] = [];
  for (const id of blocks) {
    const last = groups[groups.length - 1];
    if (id === 'river' || id === 'moments' || id === 'shelf' || id === 'releases')
      groups.push({ kind: id });
    else if (last?.kind === 'archive') last.shelves.push(id);
    else groups.push({ kind: 'archive', shelves: [id] });
  }
  return groups;
}

export function Home() {
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const likedTracksQuery = useLikedTracks(100);
  const blocks = useVisibleBlocks('home');
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);
  const menu = useLayoutMenu('home');

  const likedShelfTracks = useMemo(
    () => likedTracksQuery.tracks.slice(0, 50),
    [likedTracksQuery.tracks],
  );

  const { refetch: refetchLiked } = likedTracksQuery;
  const retryLiked = useCallback(() => void refetchLiked(), [refetchLiked]);

  return (
    <div
      data-ui="page"
      data-page="home"
      className="relative min-h-full w-full"
      onContextMenu={(event) => {
        if (!event.defaultPrevented) menu.onContextMenu(event);
      }}
    >
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5 px-[clamp(18px,3.5vw,68px)] pb-10 pt-[clamp(22px,4.6vh,56px)]">
        {groups.map((group) => {
          if (group.kind === 'river') {
            return (
              <div key="river" className="relative">
                <RiverFlow />
                <SoundWaveLockOverlay />
              </div>
            );
          }
          if (group.kind === 'moments') return <MomentsShelf key="moments" />;
          if (group.kind === 'shelf') return authenticated ? <HomeShelf key="shelf" /> : null;
          if (group.kind === 'releases') return <ReleasesShelf key="releases" />;
          return (
            <ArchiveStation
              key={group.shelves.join()}
              shelves={group.shelves}
              titled={groups.findIndex((g) => g.kind === 'archive') === groups.indexOf(group)}
              likedTracks={likedShelfTracks}
              likedLoading={likedTracksQuery.isLoading}
              likedFailed={likedTracksQuery.isError && likedShelfTracks.length === 0}
              onRetryLiked={retryLiked}
            />
          );
        })}
      </div>
      {menu.menu}
    </div>
  );
}
