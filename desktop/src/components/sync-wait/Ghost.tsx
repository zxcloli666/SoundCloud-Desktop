import { type CSSProperties, memo } from 'react';
import type { WaitShape } from './scope';

export const IGNITE_CYCLE_S = 3.4;

const FREE_DIM = 'rgb(var(--ink) / 0.07)';
const FREE_FAINT = 'rgb(var(--ink) / 0.2)';
const STAR_DIM = 'color-mix(in srgb, var(--color-accent) 14%, transparent)';
const LIT =
  'linear-gradient(140deg, color-mix(in srgb, var(--color-accent-hover) 80%, white), var(--color-accent) 58%, color-mix(in srgb, var(--color-accent) 78%, black))';
const LIT_GLOW = '0 0 10px -1px var(--color-accent-glow)';

export function ghostWidth(shape: WaitShape, size: number): number {
  return shape === 'rows' ? Math.round(size * 2.3) : size;
}

export const Ghost = memo(function Ghost({
  shape,
  size,
  lit,
  faint = false,
  igniteAt,
  glow,
}: {
  shape: WaitShape;
  size: number;
  lit: boolean;
  faint?: boolean;
  igniteAt?: number;
  glow: boolean;
}) {
  const look = { lit, faint, igniteAt, glow };
  if (shape === 'rows') {
    const art = Math.round(size * 0.64);
    return (
      <span className="flex items-center" style={{ height: size, gap: Math.round(size * 0.2) }}>
        <Part
          {...look}
          style={{ width: art, height: art, borderRadius: Math.round(size * 0.16) }}
        />
        <Part {...look} style={{ flex: 1, height: Math.round(size * 0.3), borderRadius: 999 }} />
      </span>
    );
  }
  return (
    <Part
      {...look}
      style={{
        width: size,
        height: size,
        borderRadius: shape === 'avatars' ? 999 : Math.round(size * 0.26),
      }}
    />
  );
});

function Part({
  lit,
  faint,
  igniteAt,
  glow,
  style,
}: {
  lit: boolean;
  faint: boolean;
  igniteAt?: number;
  glow: boolean;
  style: CSSProperties;
}) {
  return (
    <span
      className="relative block shrink-0"
      style={{ ...style, background: lit ? STAR_DIM : faint ? FREE_FAINT : FREE_DIM }}
    >
      {lit && (
        <span
          className={`absolute inset-0 rounded-[inherit] ${igniteAt === undefined ? '' : 'sync-wait-ignite'}`}
          style={{
            background: LIT,
            boxShadow: glow ? LIT_GLOW : undefined,
            animationDelay: igniteAt === undefined ? undefined : `${igniteAt}s`,
          }}
        />
      )}
    </span>
  );
}
