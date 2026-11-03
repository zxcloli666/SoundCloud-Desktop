import { type MarkProps, sparkle, stop } from './mark';

const HEART =
  'M32 50C18.5 41.4 13 34.6 13 27.4C13 21.8 17.3 17.6 22.6 17.6C26.4 17.6 29.7 19.7 32 23C34.3 19.7 37.6 17.6 41.4 17.6C46.7 17.6 51 21.8 51 27.4C51 34.6 45.5 41.4 32 50Z';

export function HeartMark({ uid }: MarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="block size-full">
      <defs>
        <radialGradient id={`${uid}-bg`} cx="28%" cy="20%" r="95%">
          <stop offset="0" style={stop('var(--color-orange-300)')} />
          <stop offset="0.55" style={stop('var(--color-rose-400)')} />
          <stop
            offset="1"
            style={stop('color-mix(in oklab, var(--color-rose-400) 50%, #3a0814)')}
          />
        </radialGradient>
        <linearGradient id={`${uid}-heart`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.6" style={stop('var(--color-rose-100)')} />
          <stop offset="1" style={stop('var(--color-rose-200)')} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${uid}-bg)`} />
      <path
        d={HEART}
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinejoin="round"
        opacity="0.16"
      />
      <path d={HEART} fill={`url(#${uid}-heart)`} />
      <ellipse
        cx="22.5"
        cy="25"
        rx="4.4"
        ry="2.6"
        fill="#fff"
        opacity="0.9"
        transform="rotate(-38 22.5 25)"
      />
      <path d={sparkle(51, 14, 3.4)} style={{ fill: 'var(--color-orange-100)' }} />
      <path d={sparkle(12, 46, 2.4)} fill="#fff" opacity="0.8" />
    </svg>
  );
}
