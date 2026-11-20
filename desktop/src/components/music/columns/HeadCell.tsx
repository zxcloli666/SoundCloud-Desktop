import type { ReactNode } from 'react';
import type { TrackColumnId } from '../../../stores/settings';
import { ColumnHandle } from './ColumnHandle';
import { useColumnWidth } from './TrackColumns';

export function HeadCell({ id, children }: { id: TrackColumnId; children: ReactNode }) {
  const width = useColumnWidth(id);
  return (
    <span className="relative text-right">
      <ColumnHandle id={id} width={width} />
      {children}
    </span>
  );
}
