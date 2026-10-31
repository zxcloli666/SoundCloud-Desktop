import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../lib/perf';
import { TRIAL_MS, useThemesStore } from '../../stores/themes';

const RING_SIZE = 28;
const RING_STROKE = 2.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function CountdownRing({ until }: { until: number }) {
  const ref = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const left = Math.max(0, until - Date.now());
    const start = RING_LENGTH * (1 - left / TRIAL_MS);
    const animation = ref.current?.animate(
      [{ strokeDashoffset: start }, { strokeDashoffset: RING_LENGTH }],
      { duration: left, fill: 'forwards', easing: 'linear' },
    );
    return () => animation?.cancel();
  }, [until]);

  return (
    <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90 shrink-0" aria-hidden>
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        className="stroke-ink/10"
        strokeWidth={RING_STROKE}
      />
      <circle
        ref={ref}
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
      />
    </svg>
  );
}

export function ThemeTryBar() {
  const { t } = useTranslation();
  const trial = useThemesStore((s) => s.trial);
  const blur = usePerfMode().blur(24);

  useEffect(() => {
    if (!trial) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      useThemesStore.getState().revertTrial();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [trial]);

  if (!trial) return null;
  const { keepTrial, revertTrial } = useThemesStore.getState();

  return createPortal(
    <div className="fixed left-1/2 top-[68px] z-[95] -translate-x-1/2">
      <div
        className="flex items-center gap-3 rounded-2xl py-2 pl-3 pr-2 animate-fade-in-up"
        style={{
          border: '0.5px solid rgb(var(--ink) / 0.14)',
          background: blur ? 'rgb(var(--surface) / 0.72)' : 'rgb(var(--surface) / 0.95)',
          backdropFilter: blur ? `blur(${blur}px) saturate(1.4)` : undefined,
          WebkitBackdropFilter: blur ? `blur(${blur}px) saturate(1.4)` : undefined,
          boxShadow: '0 18px 50px rgb(var(--shade) / calc(0.5 * var(--shade-alpha))), 0 0 30px var(--color-accent-glow)',
        }}
      >
        <CountdownRing key={trial.until} until={trial.until} />
        <span className="max-w-[200px] truncate text-[13px] font-semibold text-ink-85">
          {trial.version.name}
        </span>
        <button
          type="button"
          onClick={revertTrial}
          className="rounded-xl px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-60 hover:bg-ink/[0.08] hover:text-ink-90 transition-all cursor-pointer"
        >
          {t('settings.themesRevert')}
        </button>
        <button
          type="button"
          onClick={keepTrial}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-1.5 text-[12.5px] font-semibold text-[var(--color-accent-contrast)] hover:brightness-110 transition-all cursor-pointer"
        >
          {t('settings.themesKeep')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
