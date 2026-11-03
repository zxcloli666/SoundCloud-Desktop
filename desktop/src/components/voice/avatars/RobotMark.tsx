import { type MarkProps, motion, stop } from './mark';

const EYE = 'rgb(var(--mint))';

export function RobotMark({ uid, idle }: MarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="block size-full">
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="40%" r="70%">
          <stop offset="0" style={stop('color-mix(in oklab, var(--color-sky-400) 50%, #0b1424)')} />
          <stop offset="1" stopColor="#060a12" />
        </radialGradient>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stop('var(--color-sky-100)')} />
          <stop offset="1" style={stop('var(--color-sky-300)')} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${uid}-bg)`} />
      <line
        x1="32"
        y1="20.5"
        x2="32"
        y2="13.5"
        style={{ stroke: 'var(--color-sky-200)' }}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="32"
        cy="11.5"
        r="6"
        fill="var(--color-accent)"
        opacity="0.28"
        style={motion(idle, 'vx-wait 2.4s ease-in-out infinite', '32px 11.5px')}
      />
      <circle cx="32" cy="11.5" r="3.2" fill="var(--color-accent)" />
      <circle cx="31" cy="10.5" r="1" fill="#fff" opacity="0.7" />
      <rect
        x="11.5"
        y="30"
        width="5.5"
        height="11"
        rx="2.4"
        style={{ fill: 'var(--color-sky-300)' }}
      />
      <rect
        x="47"
        y="30"
        width="5.5"
        height="11"
        rx="2.4"
        style={{ fill: 'var(--color-sky-300)' }}
      />
      <rect x="16" y="20" width="32" height="28.5" rx="9" fill={`url(#${uid}-metal)`} />
      <rect x="19.5" y="22.6" width="13" height="2.8" rx="1.4" fill="#fff" opacity="0.6" />
      <rect x="20.5" y="27.2" width="23" height="15.6" rx="5.6" fill="rgb(var(--paper))" />
      <g style={motion(idle, 'vx-blink 4.2s ease-in-out infinite', '32px 33.8px')}>
        <rect x="23.6" y="29.6" width="6.4" height="8.4" rx="3.2" fill={EYE} opacity="0.22" />
        <rect x="34" y="29.6" width="6.4" height="8.4" rx="3.2" fill={EYE} opacity="0.22" />
        <rect x="25" y="30.8" width="3.6" height="6" rx="1.8" fill={EYE} />
        <rect x="35.4" y="30.8" width="3.6" height="6" rx="1.8" fill={EYE} />
      </g>
      <path
        d="M29.4 39.6q2.6 1.6 5.2 0"
        fill="none"
        stroke={EYE}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect
        x="25"
        y="49.5"
        width="14"
        height="5"
        rx="2.5"
        style={{ fill: 'var(--color-sky-300)' }}
        opacity="0.55"
      />
    </svg>
  );
}
