import { type MarkProps, sparkle, stop } from './mark';

const EDGE = 'color-mix(in oklab, var(--color-orange-400) 70%, #4a1d00)';

export function GemMark({ uid }: MarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="block size-full">
      <defs>
        <radialGradient id={`${uid}-bg`} cx="30%" cy="22%" r="95%">
          <stop offset="0" style={stop('var(--color-amber-300)')} />
          <stop offset="0.5" style={stop('var(--color-orange-400)')} />
          <stop
            offset="1"
            style={stop('color-mix(in oklab, var(--color-orange-400) 40%, #2a1004)')}
          />
        </radialGradient>
        <linearGradient id={`${uid}-gem`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" style={stop('var(--color-amber-100)')} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${uid}-bg)`} />
      <path d="M21.5 21H42.5L51 30L32 52L13 30Z" fill={`url(#${uid}-gem)`} />
      <path d="M13 30H25.5L32 52Z" style={{ fill: 'var(--color-amber-200)' }} opacity="0.5" />
      <path d="M38.5 30H51L32 52Z" style={{ fill: 'var(--color-orange-300)' }} opacity="0.45" />
      <path
        d="M21.5 21L25.5 30L32 21L38.5 30L42.5 21"
        style={{ fill: 'var(--color-amber-100)' }}
        opacity="0.6"
      />
      <path
        d="M13 30H51M21.5 21L25.5 30L32 21L38.5 30L42.5 21M25.5 30L32 52L38.5 30"
        fill="none"
        style={{ stroke: EDGE }}
        strokeWidth="0.9"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <path
        d="M21.5 21H42.5L51 30L32 52L13 30Z"
        fill="none"
        style={{ stroke: EDGE }}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d={sparkle(46, 16, 4)} fill="#fff" />
      <path d={sparkle(16, 44, 2.2)} fill="#fff" opacity="0.75" />
    </svg>
  );
}
