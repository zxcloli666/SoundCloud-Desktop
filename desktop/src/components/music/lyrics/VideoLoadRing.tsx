import React from 'react';
import { usePerfMode } from '../../../lib/perf';
import { ProgressRing } from '../../ui/ProgressRing';

const ARC = 0.28;

export const VideoLoadRing = React.memo(function VideoLoadRing({ size }: { size: number }) {
  const perf = usePerfMode();
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${perf.idleAnim ? 'animate-spin [animation-duration:1.4s]' : ''}`}
    >
      <ProgressRing value={ARC} size={size} />
    </span>
  );
});
