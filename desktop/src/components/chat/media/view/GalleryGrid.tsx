import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type KeyboardEvent,
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { NameOf } from '../../../../lib/chat/render';
import { shortDate } from '../../../../lib/chat/time';
import type { ViewImage } from './images';
import { MediaFace, useThumb } from './MediaFace';

const GAP = 3;
const MIN_TILE = 104;
const LOAD_AHEAD_ROWS = 3;

function columnsFor(width: number): number {
  return Math.min(6, Math.max(3, Math.floor((width + GAP) / (MIN_TILE + GAP))));
}

const GalleryTile = memo(function GalleryTile({
  image,
  index,
  active,
  label,
  onOpen,
  onFocus,
}: {
  image: ViewImage;
  index: number;
  active: boolean;
  label: string;
  onOpen: (index: number) => void;
  onFocus: (index: number) => void;
}) {
  const thumb = useThumb(image.mediaId);
  return (
    <button
      type="button"
      data-gallery-index={index}
      data-ui="chat-gallery-tile"
      data-state={thumb.gone ?? thumb.phase}
      tabIndex={active ? 0 : -1}
      aria-label={label}
      onFocus={() => onFocus(index)}
      onClick={() => (thumb.phase === 'failed' && !thumb.gone ? thumb.retry() : onOpen(index))}
      className="group relative size-full cursor-pointer overflow-hidden rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset"
    >
      <MediaFace
        conversationId={image.conversationId}
        mediaId={image.mediaId}
        thumb={thumb}
        compact
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-150 group-hover:bg-ink/[0.07]"
      />
    </button>
  );
});

export const GalleryGrid = memo(function GalleryGrid({
  items,
  scrollRef,
  nameOf,
  onOpen,
  onNearEnd,
}: {
  items: ViewImage[];
  scrollRef: RefObject<HTMLDivElement | null>;
  nameOf: NameOf;
  onOpen: (index: number) => void;
  onNearEnd: () => void;
}) {
  const { t, i18n } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState(0);
  const focusWanted = useRef(false);

  useLayoutEffect(() => {
    const node = gridRef.current;
    if (!node) return;
    const update = () => {
      setWidth(node.clientWidth);
      setOffset(node.offsetTop);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const columns = columnsFor(width);
  const tile = width > 0 ? (width - GAP * (columns - 1)) / columns : MIN_TILE;
  const rows = Math.ceil(items.length / columns);
  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => tile + GAP,
    overscan: 4,
    scrollMargin: offset,
  });

  useEffect(() => {
    if (tile > 0) virtualizer.measure();
  }, [tile, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const lastRow = virtualRows[virtualRows.length - 1]?.index ?? -1;

  useEffect(() => {
    if (rows > 0 && lastRow >= rows - LOAD_AHEAD_ROWS) onNearEnd();
  }, [lastRow, rows, onNearEnd]);

  useEffect(() => {
    if (active >= items.length && items.length > 0) setActive(items.length - 1);
  }, [active, items.length]);

  useEffect(() => {
    if (!focusWanted.current) return;
    let tries = 0;
    const focus = () => {
      const node = gridRef.current?.querySelector<HTMLElement>(`[data-gallery-index="${active}"]`);
      if (node) {
        focusWanted.current = false;
        node.focus({ preventScroll: true });
      } else if (tries++ < 6) requestAnimationFrame(focus);
    };
    focus();
  }, [active]);

  const move = useCallback(
    (next: number) => {
      const target = Math.min(items.length - 1, Math.max(0, next));
      focusWanted.current = true;
      virtualizer.scrollToIndex(Math.floor(target / columns), { align: 'auto' });
      setActive(target);
    },
    [items.length, columns, virtualizer],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columns,
      ArrowDown: columns,
      PageUp: -columns * 3,
      PageDown: columns * 3,
    };
    if (event.key in steps) move(active + steps[event.key]);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(items.length - 1);
    else return;
    event.preventDefault();
  };

  const label = (image: ViewImage) =>
    t('chat.gallery.grid.item', {
      name: nameOf(image.sender),
      date: shortDate(image.ts, Date.now(), i18n.language),
    });

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={t('chat.gallery.grid.label')}
      aria-rowcount={rows}
      data-ui="chat-gallery"
      onKeyDown={onKeyDown}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualRows.map((row) => {
        const start = row.index * columns;
        return (
          <div
            key={row.key}
            role="row"
            aria-rowindex={row.index + 1}
            className="absolute top-0 left-0 flex w-full"
            style={{
              gap: GAP,
              height: tile,
              transform: `translateY(${row.start - offset}px)`,
            }}
          >
            {items.slice(start, start + columns).map((image, column) => (
              <div
                key={`${image.clientId}:${image.mediaId}`}
                role="gridcell"
                style={{ width: tile, height: tile }}
                className="shrink-0"
              >
                <GalleryTile
                  image={image}
                  index={start + column}
                  active={start + column === active}
                  label={label(image)}
                  onOpen={onOpen}
                  onFocus={setActive}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
});
