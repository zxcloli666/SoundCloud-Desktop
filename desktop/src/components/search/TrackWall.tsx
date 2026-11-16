import { memo, useCallback, useMemo, useRef } from 'react';
import { armTrackWaveContinuation } from '../../lib/queue-continuation';
import type { TrackResults } from '../../lib/search';
import { useSettingsStore } from '../../stores/settings';
import { type TileKind, toWallItems } from './utils';
import { Wall } from './Wall';

interface TrackWallProps {
  results: TrackResults;
  kind: TileKind;
  onOpen?: () => void;
  wave?: boolean;
}

export const TrackWall = memo(function TrackWall({ results, kind, onOpen, wave }: TrackWallProps) {
  const items = useMemo(() => toWallItems(results.items, kind), [results.items, kind]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const similar = useSettingsStore((s) => !!wave && s.searchPlayback === 'similar');
  const getQueue = useCallback(
    () => (similar ? [] : itemsRef.current.map((item) => item.track)),
    [similar],
  );
  return (
    <div data-menu-scope="search">
      <Wall
        items={items}
        getQueue={getQueue}
        isLoading={results.isLoading}
        hasMore={results.hasMore}
        isFetchingMore={results.isFetchingMore}
        onLoadMore={results.loadMore}
        onOpen={onOpen}
        onPlay={similar ? armTrackWaveContinuation : undefined}
        moments
      />
    </div>
  );
});
