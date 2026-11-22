import { memo } from 'react';
import type { Track } from '../../stores/player';
import { InfiniteSentinel } from '../discover/InfiniteSentinel';
import { LibraryTrackRow } from '../library/LibraryTrackRow';
import { VirtualList } from '../ui/VirtualList';

interface TrackListProps {
  tracks: Track[];
  isLoading: boolean;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  onLoadMore?: () => void;
  getQueue: () => Track[];
  onPlay?: () => void;
}

const SKELETON_ROWS = 10;

export const TrackList = memo(function TrackList({
  tracks,
  isLoading,
  hasMore,
  isFetchingMore,
  onLoadMore,
  getQueue,
  onPlay,
}: TrackListProps) {
  const skeleton = isLoading && tracks.length === 0;
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-8">
      {skeleton ? (
        <div className="space-y-1.5">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div key={`row-${i}`} className="skeleton-shimmer h-[68px] rounded-2xl bg-ink/[0.05]" />
          ))}
        </div>
      ) : (
        <VirtualList
          items={tracks}
          rowHeight={76}
          overscan={8}
          getItemKey={(track) => track.urn}
          renderItem={(track, index) => (
            <div className="pb-1.5">
              <LibraryTrackRow
                track={track}
                index={index}
                queue={getQueue}
                onPlay={onPlay}
                previewOnHover
                alwaysShowPlay
              />
            </div>
          )}
        />
      )}
      {!skeleton && hasMore && onLoadMore && (
        <InfiniteSentinel hasMore={hasMore} isFetching={!!isFetchingMore} onLoadMore={onLoadMore} />
      )}
    </div>
  );
});
