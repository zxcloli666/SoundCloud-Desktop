import { type CSSProperties, memo } from 'react';
import { usePerfMode } from '../../lib/perf';
import { Ghost, ghostWidth, IGNITE_CYCLE_S } from './Ghost';
import type { WaitShape } from './scope';
import './sync-wait.css';

const SIZES = {
  md: { tile: 22, gap: 7, pad: 9, halo: 8, radius: 13, comet: 150, head: 7, trail: 30 },
  sm: { tile: 12, gap: 4, pad: 5, halo: 4, radius: 9, comet: 90, head: 5, trail: 18 },
};

const REACH = 460;
const SWEEP = 0.62;

const FREE_TRACK = 'rgb(var(--ink) / 0.025)';
const FREE_RING = 'inset 0 0 0 1px rgb(var(--ink) / 0.05)';
const STAR_TRACK =
  'linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 12%, transparent), color-mix(in srgb, var(--color-accent) 5%, transparent))';
const STAR_RING = 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 26%, transparent)';
const STAR_GLOW = '0 0 26px -10px var(--color-accent-glow)';

export const Lane = memo(function Lane({
  kind,
  shape,
  size,
  still = false,
  className = '',
}: {
  kind: 'free' | 'star';
  shape: WaitShape;
  size: 'md' | 'sm';
  still?: boolean;
  className?: string;
}) {
  const perf = usePerfMode();
  const box = SIZES[size];
  const width = ghostWidth(shape, box.tile);
  const gap = shape === 'rows' ? box.gap + 4 : box.gap;
  const pitch = width + gap;
  const count = Math.ceil((REACH - box.pad) / pitch);
  const star = kind === 'star';
  const moving = perf.idleAnim && !still;

  return (
    <div
      className={`relative min-w-0 overflow-hidden ${className}`}
      style={
        {
          padding: `${box.pad - box.halo}px`,
          borderRadius: box.radius,
          background: star ? STAR_TRACK : FREE_TRACK,
          boxShadow: star ? (perf.glow ? `${STAR_RING}, ${STAR_GLOW}` : STAR_RING) : FREE_RING,
          '--sync-wait-cycle': `${IGNITE_CYCLE_S}s`,
        } as CSSProperties
      }
    >
      <div
        className="grid overflow-hidden"
        style={{
          padding: box.halo,
          height: box.tile + box.halo * 2,
          gridTemplateColumns: `repeat(auto-fill, ${width}px)`,
          gridTemplateRows: `${box.tile}px`,
          gridAutoRows: 0,
          columnGap: gap,
          rowGap: box.halo,
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <Ghost
            key={i}
            shape={shape}
            size={box.tile}
            lit={star}
            faint={!star && i === 0}
            igniteAt={
              star && moving
                ? ((box.pad + i * pitch + width / 2) / REACH) * SWEEP * IGNITE_CYCLE_S
                : undefined
            }
            glow={star && perf.glow}
          />
        ))}
      </div>
      {star && moving && <Comet length={box.comet} head={box.head} glow={perf.glow} />}
      {!star && (
        <Crawl
          rest={box.pad + pitch * 1.25}
          pitch={pitch}
          trail={box.trail}
          head={box.head - 2}
          moving={moving}
        />
      )}
    </div>
  );
});

function Comet({ length, head, glow }: { length: number; head: number; glow: boolean }) {
  const style = {
    width: length,
    '--comet-from': `${-length}px`,
    '--comet-to': `${REACH - length}px`,
  } as CSSProperties;
  return (
    <span
      aria-hidden
      className="sync-wait-comet pointer-events-none absolute inset-y-0 left-0"
      style={style}
    >
      <span
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(100% 70% at 100% 50%, color-mix(in srgb, var(--color-accent) 38%, transparent), transparent 72%)',
        }}
      />
      <span
        className="absolute right-0 top-1/2 h-[2px] w-full -translate-y-1/2 rounded-full"
        style={{ background: 'linear-gradient(90deg, transparent, var(--color-accent-hover))' }}
      />
      <span
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full"
        style={{
          width: head,
          height: head,
          background: 'radial-gradient(circle, #fff 0 34%, var(--color-accent-hover) 72%)',
          boxShadow: glow
            ? '0 0 12px 3px var(--color-accent-glow), 0 0 4px var(--color-accent)'
            : undefined,
        }}
      />
    </span>
  );
}

function Crawl({
  rest,
  pitch,
  trail,
  head,
  moving,
}: {
  rest: number;
  pitch: number;
  trail: number;
  head: number;
  moving: boolean;
}) {
  const style = {
    left: rest - trail,
    width: trail,
    '--crawl-from': `${-pitch * 1.1}px`,
    '--crawl-to': `${pitch * 0.45}px`,
  } as CSSProperties;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 ${moving ? 'sync-wait-crawl' : ''}`}
      style={style}
    >
      <span
        className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
        style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.3))' }}
      />
      <span
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full"
        style={{ width: head, height: head, background: 'rgb(var(--ink) / 0.5)' }}
      />
    </span>
  );
}
