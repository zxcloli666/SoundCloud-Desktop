import type { ReactNode } from 'react';
import { Headphones, Heart } from '../../../lib/icons';
import type { TrackColumnId } from '../../../stores/settings';
import type { RowShape, TrackColumnsLayout } from './TrackColumns';
import { ColumnHandle } from './ColumnHandle';

function Column({
  id,
  width,
  children,
}: {
  id: TrackColumnId;
  width: number;
  children: ReactNode;
}) {
  return (
    <div className="relative flex shrink-0 items-center gap-1.5 text-ink-30" style={{ width }}>
      <ColumnHandle id={id} width={width} />
      {children}
    </div>
  );
}

export function TrackColumnsHeader({
  layout,
  shape,
}: {
  layout: TrackColumnsLayout;
  shape: RowShape;
}) {
  if (layout.plays === 0) return null;

  return (
    <div
      data-ui="track-columns"
      className="mb-1 flex h-7 items-center px-4 select-none"
      style={{ gap: shape.gap }}
    >
      <div className="flex-1" />
      <Column id="plays" width={layout.plays}>
        <Headphones size={12} />
      </Column>
      {layout.likes > 0 && (
        <Column id="likes" width={layout.likes}>
          <Heart size={12} />
        </Column>
      )}
      <div className="shrink-0" style={{ width: layout.actions }} />
      <div className="shrink-0" style={{ width: shape.duration }} />
      {shape.tail > 0 && <div className="shrink-0" style={{ width: shape.tail - shape.gap }} />}
    </div>
  );
}
