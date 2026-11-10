import { memo, useCallback, useRef } from 'react';
import type { MediaRef, MyMedia } from '../../../lib/chat/media-types';
import { VirtualGrid } from '../../ui/VirtualGrid';
import { EndSentinel } from '../storage/EndSentinel';
import { moveTileFocus, TILE_GAP, TILE_MIN, useTileSize } from '../storage/grid-size';
import { MediaTile } from '../storage/MediaTile';
import { MoreRow } from '../storage/MoreRow';
import { useReducedMotion } from '../storage/motion';
import { refOf } from './stored-list';
import { useStoredStore } from './stored-store';

function useFirstFocus() {
  const claimed = useRef(false);
  return useCallback((node: HTMLDivElement | null) => {
    const active = document.activeElement;
    const dropped = active === document.body;
    const opening = !claimed.current && active?.matches('[data-stored-back]') === true;
    if (!node || !(dropped || opening)) return;
    claimed.current = true;
    node.querySelector<HTMLElement>('[data-tile]')?.focus({ preventScroll: true });
  }, []);
}

export const StoredGrid = memo(function StoredGrid({
  items,
  onPick,
  onPreview,
}: {
  items: MyMedia[];
  onPick: (source: MediaRef) => void;
  onPreview: (item: MyMedia) => void;
}) {
  const cursor = useStoredStore((state) => state.cursor);
  const pages = useStoredStore((state) => state.pages);
  const more = useStoredStore((state) => state.more);
  const loadMore = useStoredStore((state) => state.loadMore);
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const tile = useTileSize(box);
  const first = useFirstFocus();
  const shown = useRef(items);
  shown.current = items;

  const pick = useCallback(
    (id: string) => {
      const item = shown.current.find((candidate) => candidate.id === id);
      if (item) onPick(refOf(item));
    },
    [onPick],
  );

  return (
    <div
      ref={box}
      data-ui="chat-backdrop-stored-grid"
      onKeyDown={(event) => moveTileFocus(event, box.current, tile, items.length)}
    >
      <VirtualGrid
        key={tile}
        items={items}
        itemHeight={tile}
        minColumnWidth={TILE_MIN}
        gap={TILE_GAP}
        overscan={2}
        getItemKey={(item) => item.id}
        renderItem={(item, index) => (
          <div
            ref={index === 0 ? first : undefined}
            className="size-full"
            onMouseEnter={() => onPreview(item)}
            onFocus={() => onPreview(item)}
          >
            <MediaTile
              item={item}
              index={index}
              picked={false}
              selecting={false}
              reduced={reduced}
              onPick={pick}
            />
          </div>
        )}
      />
      {cursor && <EndSentinel token={pages} onReach={() => void loadMore()} />}
      <MoreRow load={more} onRetry={() => void loadMore()} />
    </div>
  );
});
