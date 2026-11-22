import { memo, useCallback, useMemo, useRef } from 'react';
import { armTrackWaveContinuation } from '../../lib/queue-continuation';
import type { TrackResults } from '../../lib/search';
import { useSearchPrefsStore } from '../../stores/searchPrefs';
import { useSettingsStore } from '../../stores/settings';
import { TrackList } from './TrackList';
import { type TileKind, toWallItems } from './utils';
import { Wall } from './Wall';

interface TrackWallProps {
  results: TrackResults;
  kind: TileKind;
  onOpen?: () => void;
  wave?: boolean;
}

export const TrackWall = memo(function TrackWall({ results, kind, onOpen, wave }: TrackWallProps) {
  const layout = useSearchPrefsStore((s) => s.layout);
  const items = useMemo(() => toWallItems(results.items, kind), [results.items, kind]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const similar = useSettingsStore((s) => !!wave && s.searchPlayback === 'similar');
  const getQueue = useCallback(
    () => (similar ? [] : itemsRef.current.map((item) => item.track)),
    [similar],
  );
  const onPlay = similar ? armTrackWaveContinuation : undefined;
  return (
    <div data-menu-scope="search">
      {layout === 'list' ? (
        <TrackList
          tracks={results.items}
          isLoading={results.isLoading}
          hasMore={results.hasMore}
          isFetchingMore={results.isFetchingMore}
          onLoadMore={results.loadMore}
          getQueue={getQueue}
          onPlay={onPlay}
        />
      ) : (
        <Wall
          items={items}
          getQueue={getQueue}
          isLoading={results.isLoading}
          hasMore={results.hasMore}
          isFetchingMore={results.isFetchingMore}
          onLoadMore={results.loadMore}
          onOpen={onOpen}
          onPlay={onPlay}
          moments
        />
      )}
    </div>
  );
});
