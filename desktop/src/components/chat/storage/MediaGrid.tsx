import { type KeyboardEvent, memo, useCallback, useMemo, useRef } from 'react';
import type { MyMedia } from '../../../lib/chat/media-types';
import { VirtualGrid } from '../../ui/VirtualGrid';
import { EndSentinel } from './EndSentinel';
import { moveTileFocus, TILE_GAP, TILE_MIN, useTileSize } from './grid-size';
import { MediaTile } from './MediaTile';
import { MoreRow } from './MoreRow';
import { useReducedMotion } from './motion';
import { useSelectionStore } from './selection-store';
import { useStorageStore } from './storage-store';

export const MediaGrid = memo(function MediaGrid({ items }: { items: MyMedia[] }) {
  const cursor = useStorageStore((state) => state.cursor);
  const moreLoad = useStorageStore((state) => state.moreLoad);
  const loadMore = useStorageStore((state) => state.loadMore);
  const picked = useSelectionStore((state) => state.picked);
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const tile = useTileSize(box);
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const selecting = picked.size > 0;

  const onPick = useCallback((id: string, index: number, range: boolean) => {
    const selection = useSelectionStore.getState();
    if (range) selection.range(idsRef.current, index);
    else selection.toggle(id);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const onTile = (event.target as HTMLElement).dataset.tile !== undefined;
    if (onTile && event.code === 'Space') {
      event.stopPropagation();
      return;
    }
    const next = moveTileFocus(event, box.current, tile, ids.length);
    if (next !== null && event.shiftKey) useSelectionStore.getState().range(ids, next);
  };

  return (
    <div ref={box} data-ui="chat-storage-grid" onKeyDown={onKeyDown}>
      <VirtualGrid
        key={tile}
        items={items}
        itemHeight={tile}
        minColumnWidth={TILE_MIN}
        gap={TILE_GAP}
        overscan={3}
        getItemKey={(item) => item.id}
        renderItem={(item, index) => (
          <MediaTile
            item={item}
            index={index}
            picked={picked.has(item.id)}
            selecting={selecting}
            reduced={reduced}
            onPick={onPick}
          />
        )}
      />
      {cursor && <EndSentinel token={items.length} onReach={() => void loadMore()} />}
      <MoreRow load={moreLoad} onRetry={() => void loadMore()} />
    </div>
  );
});
