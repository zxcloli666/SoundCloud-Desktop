import { type KeyboardEvent, memo, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MyMedia } from '../../../lib/chat/media-types';
import { Loader2, RefreshCw } from '../../../lib/icons';
import { VirtualGrid } from '../../ui/VirtualGrid';
import { EndSentinel } from './EndSentinel';
import { columnsIn, TILE_GAP, TILE_MIN, useTileSize } from './grid-size';
import { MediaTile } from './MediaTile';
import { useReducedMotion } from './motion';
import { useSelectionStore } from './selection-store';
import { useStorageStore } from './storage-store';

function stepFor(key: string, columns: number): number | null {
  if (key === 'ArrowRight') return 1;
  if (key === 'ArrowLeft') return -1;
  if (key === 'ArrowDown') return columns;
  if (key === 'ArrowUp') return -columns;
  return null;
}

function MoreRow() {
  const { t } = useTranslation();
  const moreLoad = useStorageStore((state) => state.moreLoad);
  const loadMore = useStorageStore((state) => state.loadMore);
  if (moreLoad === 'loading') {
    return (
      <div className="flex justify-center py-5 text-ink-40">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }
  if (moreLoad !== 'failed') return null;
  return (
    <div className="flex items-center justify-center gap-3 py-5 text-[12.5px] text-ink-55">
      {t('chat.storage.errors.more')}
      <button
        type="button"
        onClick={() => void loadMore()}
        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-ink/[0.06] px-3 py-1.5 font-semibold text-ink-75 outline-none hover:bg-ink/[0.1] focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <RefreshCw size={12} />
        {t('chat.storage.retry')}
      </button>
    </div>
  );
}

export const MediaGrid = memo(function MediaGrid({ items }: { items: MyMedia[] }) {
  const cursor = useStorageStore((state) => state.cursor);
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
    else selection.toggle(id, index);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const node = box.current;
    if (!node || target.dataset.tile === undefined) return;
    const step = stepFor(event.key, columnsIn(node, tile));
    if (step === null) return;
    event.preventDefault();
    const at = Number(target.dataset.tile);
    const next = Math.min(ids.length - 1, Math.max(0, at + step));
    const nextTile = node.querySelector<HTMLElement>(`[data-tile="${next}"]`);
    if (!nextTile) return;
    nextTile.focus({ preventScroll: true });
    nextTile.scrollIntoView({ block: 'nearest' });
    if (event.shiftKey) useSelectionStore.getState().range(ids, next);
  };

  return (
    <div ref={box} data-ui="chat-storage-grid" onKeyDown={onKeyDown}>
      <VirtualGrid
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
      <MoreRow />
    </div>
  );
});
