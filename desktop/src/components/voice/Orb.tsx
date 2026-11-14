import { memo, useRef } from 'react';
import { usePerfMode } from '../../lib/perf';
import { CircleAlert, Mic, MicOff } from './icons';
import { useLevelDrive } from './useLevelDrive';

export type OrbMode = 'off' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

function coreBackground(mode: OrbMode): string {
  if (mode === 'off')
    return 'linear-gradient(160deg, rgb(var(--ink) / 0.12), rgb(var(--ink) / 0.04))';
  const tone = mode === 'error' ? 'rgb(var(--bad))' : 'var(--color-accent)';
  return `radial-gradient(120% 120% at 30% 18%, color-mix(in srgb, ${tone} 70%, #fff) 0%, ${tone} 46%, color-mix(in srgb, ${tone} 52%, #000) 100%)`;
}

export const Orb = memo(function Orb({
  size,
  mode,
  input = null,
  label,
  onClick,
}: {
  size: number;
  mode: OrbMode;
  input?: string | null;
  label: string;
  onClick?: () => void;
}) {
  const perf = usePerfMode();
  const rootRef = useRef<HTMLDivElement>(null);
  const live = mode === 'listening';
  useLevelDrive(rootRef, input, live);
  const tone = mode === 'error' ? 'rgb(var(--bad))' : 'var(--color-accent)';
  const glowBlur = perf.blur(Math.round(size * 0.22));
  const iconSize = Math.round(size * 0.2);
  const lit = mode !== 'off';

  return (
    <div
      ref={rootRef}
      data-ui="voice-orb"
      data-mode={mode}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      {perf.bloom && lit && (
        <span
          aria-hidden
          className="absolute rounded-full pointer-events-none motion-reduce:animate-none"
          style={{
            inset: -size * 0.3,
            background: `radial-gradient(circle, ${tone} 0%, transparent 62%)`,
            opacity: live ? 0.55 : 0.4,
            filter: glowBlur ? `blur(${glowBlur}px)` : undefined,
            contain: 'strict',
            transform: 'translateZ(0)',
            animation:
              perf.idleAnim && mode === 'idle' ? 'vx-breathe 5s ease-in-out infinite' : undefined,
          }}
        />
      )}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full pointer-events-none transition-[opacity,border-color] duration-500"
        style={{
          border: `1px solid ${lit ? tone : 'rgb(var(--ink) / 0.12)'}`,
          opacity: live ? 0.75 : 0.28,
          transform: 'scale(calc(1 + var(--lvl, 0) * 0.3))',
          transition: 'transform 90ms linear, opacity 500ms var(--ease-apple)',
          willChange: live ? 'transform' : undefined,
        }}
      />
      <span
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: '9%',
          background: lit
            ? `color-mix(in srgb, ${tone} 16%, transparent)`
            : 'rgb(var(--ink) / 0.03)',
          border: `0.5px solid ${lit ? `color-mix(in srgb, ${tone} 40%, transparent)` : 'rgb(var(--ink) / 0.08)'}`,
          transform: 'scale(calc(1 + var(--lvl, 0) * 0.16))',
          transition: 'transform 90ms linear',
        }}
      />
      {mode === 'thinking' && (
        <span
          aria-hidden
          className="absolute rounded-full pointer-events-none motion-reduce:animate-none"
          style={{
            inset: '4%',
            background: `conic-gradient(from 0deg, transparent 0deg, ${tone} 90deg, transparent 200deg)`,
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
            animation: 'vx-spin 1.1s linear infinite',
          }}
        />
      )}
      {mode === 'speaking' &&
        [0, 1].map((i) => (
          <span
            key={i}
            aria-hidden
            className="absolute rounded-full pointer-events-none motion-reduce:hidden"
            style={{
              inset: '16%',
              border: `1.5px solid ${tone}`,
              animation: `vx-ripple 1.8s var(--ease-apple) ${i * 0.9}s infinite`,
            }}
          />
        ))}
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        aria-label={label}
        title={label}
        className="absolute rounded-full flex items-center justify-center overflow-hidden transition-transform duration-500 ease-[var(--ease-apple)] enabled:hover:scale-[1.04] enabled:active:scale-[0.96] enabled:cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        style={{
          inset: '17%',
          background: coreBackground(mode),
          boxShadow: lit
            ? `0 ${size * 0.08}px ${size * 0.22}px -${size * 0.06}px ${mode === 'error' ? 'rgb(var(--bad) / 0.5)' : 'var(--color-accent-glow)'}, inset 0 1px 0 rgba(255,255,255,0.35)`
            : 'inset 0 1px 0 rgba(255,255,255,0.08)',
          border: lit ? 'none' : '0.5px solid rgb(var(--ink) / 0.12)',
        }}
      >
        {lit && (
          <span
            aria-hidden
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: '7% 34% 58% 14%',
              background: 'radial-gradient(closest-side, #fff, transparent)',
              opacity: 0.4,
            }}
          />
        )}
        <span className={`relative ${lit ? 'text-accent-contrast' : 'text-ink-40'}`}>
          {mode === 'off' ? (
            <MicOff size={iconSize} />
          ) : mode === 'error' ? (
            <CircleAlert size={iconSize} strokeWidth={2.2} />
          ) : (
            <Mic size={iconSize} strokeWidth={2.2} />
          )}
        </span>
      </button>
    </div>
  );
});
