import { memo, useCallback, useMemo, useRef } from 'react';
import { armTrackWaveContinuation } from '../../lib/queue-continuation';
import type { Track } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import { type TileKind, toWallItems } from './utils';
import { Wall } from './Wall';

interface TrackWallProps {
  tracks: Track[];
  kind: TileKind;
  isLoading: boolean;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  onLoadMore?: () => void;
  onOpen?: () => void;
  wave?: boolean;
}

export const TrackWall = memo(function TrackWall({
  tracks,
  kind,
  isLoading,
  hasMore,
  isFetchingMore,
  onLoadMore,
  onOpen,
  wave,
}: TrackWallProps) {
  const items = useMemo(() => toWallItems(tracks, kind), [tracks, kind]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const similar = useSettingsStore((s) => !!wave && s.searchPlayback === 'similar');
  const getQueue = useCallback(
    () => (similar ? [] : itemsRef.current.map((item) => item.track)),
    [similar],
  );
  return (
    <Wall
      items={items}
      getQueue={getQueue}
      isLoading={isLoading}
      hasMore={hasMore}
      isFetchingMore={isFetchingMore}
      onLoadMore={onLoadMore}
      onOpen={onOpen}
      onPlay={similar ? armTrackWaveContinuation : undefined}
    />
  );
});
