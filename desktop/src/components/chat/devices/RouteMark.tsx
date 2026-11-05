import { memo } from 'react';
import type { Tier } from '../../../lib/chat/types';

const HOP = 'M11 1.6 L14.4 5 L11 8.4 L7.6 5 Z';

export const RouteMark = memo(function RouteMark({ tier }: { tier: Tier }) {
  const hop = tier !== 'direct';
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" className="shrink-0" aria-hidden>
      <g stroke="currentColor" strokeOpacity={0.55} strokeWidth="1.2">
        {hop ? (
          <>
            <line x1="3" y1="5" x2="7" y2="5" />
            <line x1="15" y1="5" x2="19" y2="5" />
          </>
        ) : (
          <line x1="3" y1="5" x2="19" y2="5" />
        )}
      </g>
      <circle cx="3" cy="5" r="2" fill="currentColor" />
      <circle cx="19" cy="5" r="2" fill="currentColor" />
      {hop && (
        <path
          d={HOP}
          fill={tier === 'pro' ? 'var(--color-accent)' : 'none'}
          stroke={tier === 'pro' ? 'none' : 'currentColor'}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
});
