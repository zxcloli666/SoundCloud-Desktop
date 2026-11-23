import React from 'react';
import { usePerfMode } from '../../../lib/perf';
import { ProgressRing } from '../../ui/ProgressRing';

const UNKNOWN_ARC = 0.25;

export const VideoLoadRing = React.memo(function VideoLoadRing({
  share,
  size,
}: {
  share: number | null;
  size: number;
}) {
  const perf = usePerfMode();
  const spin = share === null && perf.idleAnim;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${spin ? 'animate-spin [animation-duration:1.4s]' : ''}`}
    >
      <ProgressRing value={share ?? UNKNOWN_ARC} size={size} />
    </span>
  );
});
