import { type MarkProps, motion, sparkle, stop } from './mark';

const EYES = 'color-mix(in oklab, var(--color-rose-400) 55%, #3b0a24)';

const SPARKS = [
  { x: 51, y: 17, r: 4.2, delay: 0 },
  { x: 12.5, y: 21, r: 3, delay: 1.1 },
  { x: 52, y: 47, r: 2.6, delay: 2 },
];

export function LolyaMark({ uid, idle }: MarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="block size-full">
      <defs>
        <radialGradient id={`${uid}-bg`} cx="34%" cy="22%" r="90%">
          <stop offset="0" style={stop('var(--color-rose-200)')} />
          <stop offset="0.6" style={stop('var(--color-rose-300)')} />
          <stop
            offset="1"
            style={stop('color-mix(in oklab, var(--color-rose-400) 60%, var(--color-violet-400))')}
          />
        </radialGradient>
        <radialGradient id={`${uid}-body`} cx="38%" cy="30%" r="78%">
          <stop offset="0" stopColor="#fff" />
          <stop
            offset="0.68"
            style={stop('color-mix(in oklab, var(--color-rose-100) 55%, #fff)')}
          />
          <stop offset="1" style={stop('var(--color-rose-200)')} />
        </radialGradient>
        <linearGradient id={`${uid}-wing`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" style={stop('var(--color-rose-100)')} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${uid}-bg)`} />
      <g style={motion(idle, 'vx-halo 3.2s ease-in-out infinite', '32px 13px')}>
        <ellipse cx="32" cy="13" rx="15" ry="5.6" fill="#fff" opacity="0.28" />
        <ellipse
          cx="32"
          cy="13"
          rx="10.5"
          ry="3.2"
          fill="none"
          style={{ stroke: 'var(--color-amber-200)' }}
          strokeWidth="2.8"
        />
        <ellipse cx="32" cy="13" rx="10.5" ry="3.2" fill="none" stroke="#fff" strokeWidth="1" />
      </g>
      <g style={motion(idle, 'vx-flap-l 3.6s ease-in-out infinite', '18px 38px')}>
        <path
          d="M18.5 34C13 26.5 6 24.6 4.4 29.3C3.4 32.4 5.4 34.6 7.6 35.1C6 37.2 7.1 40 10.2 40.1C10.3 42.6 13.3 43.6 18.5 41Z"
          fill={`url(#${uid}-wing)`}
          style={{ stroke: 'var(--color-rose-300)' }}
          strokeWidth="0.8"
        />
        <path
          d="M8.6 33.4Q12.2 34.6 15.6 34.4M11 37.9Q13.8 38.6 16.4 38.1"
          fill="none"
          style={{ stroke: 'var(--color-rose-200)' }}
          strokeWidth="1"
          strokeLinecap="round"
        />
      </g>
      <g style={motion(idle, 'vx-flap-r 3.6s ease-in-out infinite', '46px 38px')}>
        <path
          d="M45.5 34C51 26.5 58 24.6 59.6 29.3C60.6 32.4 58.6 34.6 56.4 35.1C58 37.2 56.9 40 53.8 40.1C53.7 42.6 50.7 43.6 45.5 41Z"
          fill={`url(#${uid}-wing)`}
          style={{ stroke: 'var(--color-rose-300)' }}
          strokeWidth="0.8"
        />
        <path
          d="M55.4 33.4Q51.8 34.6 48.4 34.4M53 37.9Q50.2 38.6 47.6 38.1"
          fill="none"
          style={{ stroke: 'var(--color-rose-200)' }}
          strokeWidth="1"
          strokeLinecap="round"
        />
      </g>
      <circle cx="32" cy="38.5" r="16" fill={`url(#${uid}-body)`} />
      <ellipse
        cx="26"
        cy="29.5"
        rx="5"
        ry="2.8"
        fill="#fff"
        opacity="0.85"
        transform="rotate(-22 26 29.5)"
      />
      <ellipse
        cx="22.6"
        cy="42.2"
        rx="3.2"
        ry="2"
        style={{ fill: 'var(--color-rose-300)' }}
        opacity="0.6"
      />
      <ellipse
        cx="41.4"
        cy="42.2"
        rx="3.2"
        ry="2"
        style={{ fill: 'var(--color-rose-300)' }}
        opacity="0.6"
      />
      <path
        d="M23.8 38.6q2.6-2.9 5.2 0M35 38.6q2.6-2.9 5.2 0"
        fill="none"
        style={{ stroke: EYES }}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M30.3 42.8q1.7 1.7 3.4 0"
        fill="none"
        style={{ stroke: EYES }}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {SPARKS.map((s) => (
        <path
          key={s.x}
          d={sparkle(s.x, s.y, s.r)}
          fill="#fff"
          style={motion(
            idle,
            `vx-twinkle 2.8s ease-in-out ${s.delay}s infinite`,
            `${s.x}px ${s.y}px`,
          )}
        />
      ))}
    </svg>
  );
}
