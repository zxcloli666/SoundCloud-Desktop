import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useEffect, useMemo, useRef, useState } from 'react';

interface VirtualGridProps<T> {
  items: T[];
  itemHeight: number;
  minColumnWidth: number;
  gap?: number;
  overscan?: number;
  className?: string;
  disabled?: boolean;
  getItemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
}

export function VirtualGrid<T>({
  items,
  itemHeight,
  minColumnWidth,
  gap = 16,
  overscan = 4,
  className,
  disabled = false,
  getItemKey,
  renderItem,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setScrollElement((containerRef.current?.closest('main') as HTMLElement | null) ?? null);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => setWidth(node.clientWidth);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const { columns, itemWidth, rowCount } = useMemo(() => {
    const safeWidth = Math.max(width, minColumnWidth);
    const nextColumns = Math.max(1, Math.floor((safeWidth + gap) / (minColumnWidth + gap)));
    const totalGap = gap * Math.max(0, nextColumns - 1);
    const nextItemWidth = (safeWidth - totalGap) / nextColumns;
    return {
      columns: nextColumns,
      itemWidth: nextItemWidth,
      rowCount: Math.ceil(items.length / nextColumns),
    };
  }, [gap, items.length, minColumnWidth, width]);

  const rowHeight = itemHeight + gap;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollElement,
    estimateSize: () => rowHeight,
    overscan,
  });

  if (disabled) {
    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap,
        }}
      >
        {items.map((item, index) => (
          <React.Fragment key={getItemKey(item, index)}>{renderItem(item, index)}</React.Fragment>
        ))}
      </div>
    );
  }

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: totalHeight, position: 'relative', width: '100%' }}
    >
      {virtualRows.map((virtualRow) => {
        const startIndex = virtualRow.index * columns;
        const rowItems = items.slice(startIndex, startIndex + columns);

        return (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: itemHeight,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {rowItems.map((item, columnIndex) => {
              const itemIndex = startIndex + columnIndex;
              return (
                <div
                  key={getItemKey(item, itemIndex)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: columnIndex * (itemWidth + gap),
                    width: itemWidth,
                    height: itemHeight,
                  }}
                >
                  {renderItem(item, itemIndex)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
