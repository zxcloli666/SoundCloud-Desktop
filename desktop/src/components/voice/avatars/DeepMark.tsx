import { type MarkProps, stop } from './mark';

export function DeepMark({ uid }: MarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="block size-full">
      <defs>
        <radialGradient id={`${uid}-bg`} cx="30%" cy="22%" r="95%">
          <stop offset="0" style={stop('var(--color-blue-400)')} />
          <stop offset="0.5" style={stop('var(--color-violet-400)')} />
          <stop
            offset="1"
            style={stop('color-mix(in oklab, var(--color-violet-400) 35%, #0a0a26)')}
          />
        </radialGradient>
        <linearGradient id={`${uid}-sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={stop('var(--color-amber-100)')} />
          <stop offset="1" style={stop('var(--color-orange-300)')} />
        </linearGradient>
        <clipPath id={`${uid}-disc`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${uid}-bg)`} />
      <circle cx="14" cy="17" r="1.1" fill="#fff" opacity="0.8" />
      <circle cx="22" cy="10" r="0.8" fill="#fff" opacity="0.6" />
      <circle cx="51" cy="15" r="0.9" fill="#fff" opacity="0.7" />
      <g clipPath={`url(#${uid}-disc)`}>
        <circle cx="42" cy="29" r="12" fill="#fff" opacity="0.08" />
        <circle cx="42" cy="29" r="8.5" fill={`url(#${uid}-sun)`} />
        <path
          d="M0 50L15 35L24 42L37 27L64 50V64H0Z"
          style={{ fill: 'color-mix(in oklab, var(--color-blue-400) 45%, #0c1032)' }}
        />
        <path d="M37 27L33 31L35.6 30.6L37 32.6L38.8 30.6L41.6 31.4Z" fill="#fff" opacity="0.85" />
        <path
          d="M0 57L19 40L33 52L45 43L64 57V64H0Z"
          style={{ fill: 'color-mix(in oklab, var(--color-violet-400) 30%, #070720)' }}
        />
        <path d="M19 40L15.8 42.8L18 42.4L19 43.8L20.4 42.4L22.4 43Z" fill="#fff" opacity="0.6" />
      </g>
    </svg>
  );
}
