import type { CSSProperties } from 'react';
import { useColumnWidth } from './TrackColumns';

export function useColumnVars(): CSSProperties {
  const size = useColumnWidth('size');
  const time = useColumnWidth('time');
  return { '--col-size': `${size}px`, '--col-time': `${time}px` } as CSSProperties;
}
