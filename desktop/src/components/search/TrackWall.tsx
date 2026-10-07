import { memo, useCallback, useMemo, useRef } from 'react';
import type { Track } from '../../stores/player';
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
}

export const TrackWall = memo(function TrackWall({
  tracks,
  kind,
  isLoading,
  hasMore,
  isFetchingMore,
  onLoadMore,
  onOpen,
}: TrackWallProps) {
  const items = useMemo(() => toWallItems(tracks, kind), [tracks, kind]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const getQueue = useCallback(() => itemsRef.current.map((item) => item.track), []);
  return (
    <Wall
      items={items}
      getQueue={getQueue}
      isLoading={isLoading}
      hasMore={hasMore}
      isFetchingMore={isFetchingMore}
      onLoadMore={onLoadMore}
      onOpen={onOpen}
    />
  );
});
