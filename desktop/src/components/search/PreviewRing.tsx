import type { CSSProperties } from 'react';
import { PREVIEW_WINDOW_MS } from '../../lib/audioPreview';

export function PreviewRing({ radius = 7 }: { radius?: number }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect
        x="1.5"
        y="1.5"
        width="97"
        height="97"
        rx={radius}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.6"
        pathLength={1000}
        strokeDasharray={1000}
        style={
          {
            '--tg-ring-len': '1000',
            strokeDashoffset: 1000,
            animation: `tg-ring-sweep ${PREVIEW_WINDOW_MS}ms linear forwards`,
          } as CSSProperties
        }
      />
    </svg>
  );
}
