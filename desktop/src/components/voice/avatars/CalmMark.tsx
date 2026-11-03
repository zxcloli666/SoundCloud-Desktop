import { type MarkProps, stop } from './mark';

const DEEP = 'color-mix(in oklab, var(--color-sky-400) 60%, #06202c)';

export function CalmMark({ uid }: MarkProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="block size-full">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            style={stop('color-mix(in oklab, var(--color-emerald-300) 55%, var(--color-sky-300))')}
          />
          <stop offset="1" style={stop(DEEP)} />
        </linearGradient>
        <linearGradient id={`${uid}-moon`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" style={stop('rgb(var(--mint))')} />
        </linearGradient>
        <mask id={`${uid}-cut`}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="38.5" cy="21.5" r="11.5" fill="#000" />
        </mask>
        <clipPath id={`${uid}-disc`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${uid}-bg)`} />
      <circle cx="46" cy="13" r="1.3" fill="#fff" opacity="0.85" />
      <circle cx="53" cy="23" r="0.9" fill="#fff" opacity="0.7" />
      <circle cx="15" cy="15" r="1" fill="#fff" opacity="0.7" />
      <circle cx="30.5" cy="28.5" r="16" fill="#fff" opacity="0.1" mask={`url(#${uid}-cut)`} />
      <circle cx="30.5" cy="28.5" r="13" fill={`url(#${uid}-moon)`} mask={`url(#${uid}-cut)`} />
      <path
        d="M21.6 30.4q2.4 2.3 4.8 0"
        fill="none"
        style={{ stroke: DEEP }}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <ellipse
        cx="22.4"
        cy="35"
        rx="2.4"
        ry="1.4"
        style={{ fill: 'var(--color-sky-300)' }}
        opacity="0.55"
      />
      <g clipPath={`url(#${uid}-disc)`}>
        <path d="M0 46Q8 42 16 46T32 46T48 46T64 46V64H0Z" fill="#fff" opacity="0.16" />
        <path d="M0 51.5Q8 47.5 16 51.5T32 51.5T48 51.5T64 51.5V64H0Z" fill="#fff" opacity="0.2" />
      </g>
    </svg>
  );
}
