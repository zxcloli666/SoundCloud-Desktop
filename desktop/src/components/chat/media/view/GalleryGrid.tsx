import { defaultRangeExtractor, type Range, useVirtualizer } from '@tanstack/react-virtual';
import {
  type KeyboardEvent,
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { NameOf } from '../../../../lib/chat/render';
import { shortDate } from '../../../../lib/chat/time';
import type { ViewImage } from './images';
import { MediaFace, thumbLabelKey, useThumb } from './MediaFace';
import { type OpenAt, tileKeys } from './tile-keys';

const GAP = 3;
const MIN_TILE = 104;
const LOAD_AHEAD_ROWS = 3;
const TAB_BAR = 60;

function columnsFor(width: number): number {
  return Math.min(6, Math.max(3, Math.floor((width + GAP) / (MIN_TILE + GAP))));
}

function keyOf(image: ViewImage): string {
  return `${image.clientId}:${image.mediaId}`;
}

function stepTarget(key: string, active: number, columns: number, count: number): number | null {
  const row = Math.floor(active / columns);
  const lastRow = Math.floor((count - 1) / columns);
  switch (key) {
    case 'ArrowLeft':
      return active > 0 ? active - 1 : null;
    case 'ArrowRight':
      return active < count - 1 ? active + 1 : null;
    case 'ArrowUp':
      return row > 0 ? active - columns : null;
    case 'ArrowDown':
      return row < lastRow ? Math.min(count - 1, active + columns) : null;
    case 'PageUp':
      return Math.max(0, active - columns * 3);
    case 'PageDown':
      return Math.min(count - 1, active + columns * 3);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

const STEP_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

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
  onOpen: OpenAt;
  onFocus: (index: number) => void;
}) {
  const { t } = useTranslation();
  const thumb = useThumb(image.mediaId);
  const problem = thumbLabelKey(thumb);
  const activate = (opener: HTMLElement) =>
    thumb.phase === 'failed' && !thumb.gone ? thumb.retry() : onOpen(index, opener);
  return (
    <button
      type="button"
      data-gallery-index={index}
      data-ui="chat-gallery-tile"
      data-state={thumb.gone ?? thumb.phase}
      tabIndex={active ? 0 : -1}
      aria-label={problem ? t('chat.gallery.grid.itemState', { item: label, state: t(problem) }) : label}
      onFocus={() => onFocus(index)}
      onClick={(event) => activate(event.currentTarget)}
      onKeyDown={(event) => tileKeys(event, activate)}
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
  onOpen: OpenAt;
  onNearEnd: () => void;
}) {
  const { t, i18n } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [offset, setOffset] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const focusWanted = useRef(false);
  const itemsRef = useRef(items);
  useLayoutEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const positions = useMemo(
    () => new Map(items.map((image, index) => [keyOf(image), index])),
    [items],
  );
  const found = activeKey === null ? undefined : positions.get(activeKey);
  const active = found ?? 0;

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
  const activeRow = Math.floor(active / columns);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const shown = defaultRangeExtractor(range);
      if (activeRow >= range.count || shown.includes(activeRow)) return shown;
      return [...shown, activeRow].sort((a, b) => a - b);
    },
    [activeRow],
  );
  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => tile + GAP,
    overscan: 4,
    scrollMargin: offset,
    scrollPaddingStart: TAB_BAR,
    rangeExtractor,
  });

  useEffect(() => {
    if (tile > 0) virtualizer.measure();
  }, [tile, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const lastRow = virtualRows[virtualRows.length - 1]?.index ?? -1;

  const askedAt = useRef(-1);
  useEffect(() => {
    if (
      rows === 0 ||
      lastRow < rows - LOAD_AHEAD_ROWS ||
      askedAt.current === items.length
    ) {
      return;
    }
    askedAt.current = items.length;
    onNearEnd();
  }, [lastRow, rows, items.length, onNearEnd]);

  useEffect(() => {
    if (!focusWanted.current) return;
    let tries = 0;
    let frame = 0;
    const focus = () => {
      const node = gridRef.current?.querySelector<HTMLElement>(`[data-gallery-index="${active}"]`);
      if (node) {
        focusWanted.current = false;
        node.focus({ preventScroll: true });
      } else if (tries++ < 6) frame = requestAnimationFrame(focus);
    };
    focus();
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const focusAt = useCallback((index: number) => {
    const image = itemsRef.current[index];
    if (image) setActiveKey(keyOf(image));
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!STEP_KEYS.has(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const target = stepTarget(event.key, active, columns, items.length);
    if (target === null || target === active) return;
    focusWanted.current = true;
    virtualizer.scrollToIndex(Math.floor(target / columns), { align: 'auto' });
    focusAt(target);
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
      aria-colcount={columns}
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
                key={keyOf(image)}
                role="gridcell"
                aria-colindex={column + 1}
                style={{ width: tile, height: tile }}
                className="shrink-0"
              >
                <GalleryTile
                  image={image}
                  index={start + column}
                  active={start + column === active}
                  label={label(image)}
                  onOpen={onOpen}
                  onFocus={focusAt}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
});
