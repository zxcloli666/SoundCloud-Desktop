import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EQ_LABELS, EQ_MAX_GAIN, EQ_MIN_GAIN } from '../../lib/equalizer';
import {
  bandAt,
  bandX,
  clampGain,
  curvePath,
  curvePoints,
  gainAt,
  gainY,
} from '../../lib/sound/eq-curve';
import { formatGain } from '../../lib/sound/live';
import { useWheelStep } from '../../lib/useWheelStep';
import { useSettingsStore } from '../../stores/settings';
import { EqSpectrum } from './EqSpectrum';
import { BAND, GAIN } from './styles';

const W = 400;
const H = 100;
const WHEEL_STEP = 0.5;
const KEYS: Record<string, number> = {
  ArrowUp: 0.5,
  ArrowRight: 0.5,
  ArrowDown: -0.5,
  ArrowLeft: -0.5,
  PageUp: 3,
  PageDown: -3,
};

const SCALE =
  'pointer-events-none absolute inset-y-1.5 left-2 flex flex-col justify-between text-[9.5px] font-medium leading-none tabular-nums text-ink-25';

export function EqCurve({ full }: { full: boolean }) {
  const { t } = useTranslation();
  const plot = useRef<HTMLDivElement>(null);
  const on = useSettingsStore((s) => s.eqEnabled);
  const gains = useSettingsStore((s) => s.eqGains);
  const setEqBand = useSettingsStore((s) => s.setEqBand);
  const setEqEnabled = useSettingsStore((s) => s.setEqEnabled);
  const [held, setHeld] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const line = useMemo(() => curvePath(curvePoints(gains, W, H)), [gains]);
  const lit = held ?? hover;

  const set = (band: number, gain: number) => {
    if (!on) setEqEnabled(true);
    setEqBand(band, clampGain(gain));
  };
  const at = (e: { clientX: number; clientY: number }) => {
    const box = plot.current?.getBoundingClientRect();
    if (!box) return { band: 0, gain: 0 };
    return {
      band: bandAt((e.clientX - box.left) / box.width),
      gain: gainAt((e.clientY - box.top) / box.height),
    };
  };
  useWheelStep(plot, (direction, event) => {
    const { band } = at(event);
    set(band, gains[band] + direction * WHEEL_STEP);
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5" data-ui="sound-eq-curve">
      <div
        ref={plot}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const { band, gain } = at(e);
          setHeld(band);
          set(band, gain);
        }}
        onPointerMove={(e) => {
          const { band, gain } = at(e);
          if (held === null) setHover(band);
          else set(held, gain);
        }}
        onPointerUp={() => setHeld(null)}
        onPointerCancel={() => setHeld(null)}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={() => lit !== null && set(lit, 0)}
        className="relative min-h-0 flex-1 cursor-ns-resize touch-none select-none overflow-hidden rounded-[14px] border border-ink/[0.08] bg-ink/[0.025]"
      >
        <EqSpectrum className="absolute inset-0 size-full" />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden
          className={`absolute inset-0 size-full transition-opacity duration-300 ${on ? '' : 'opacity-35'}`}
        >
          <defs>
            <linearGradient id="sound-eq-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.42" />
              <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line
            x1="0"
            x2={W}
            y1={H / 2}
            y2={H / 2}
            stroke="rgb(var(--ink) / 0.14)"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
          />
          <path d={`${line}L${W} ${H}L0 ${H}Z`} fill="url(#sound-eq-fill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {gains.map((gain, band) => (
          <span
            key={EQ_LABELS[band]}
            role="slider"
            tabIndex={0}
            aria-label={EQ_LABELS[band]}
            aria-valuemin={EQ_MIN_GAIN}
            aria-valuemax={EQ_MAX_GAIN}
            aria-valuenow={gain}
            aria-valuetext={t('sound.db', { value: formatGain(gain) })}
            onKeyDown={(e) => {
              const step = KEYS[e.key];
              if (!step) return;
              e.preventDefault();
              set(band, gain + step);
            }}
            onFocus={() => setHover(band)}
            onBlur={() => setHover(null)}
            style={{ left: `${bandX(band) * 100}%`, top: `${gainY(gain) * 100}%` }}
            className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent outline-none transition-[background-color,scale,opacity] duration-150 ${
              lit === band ? 'scale-[1.35] bg-accent' : 'bg-[rgb(var(--surface-hi))]'
            } ${on ? '' : 'opacity-50'}`}
          />
        ))}
        {full && (
          <span aria-hidden className={SCALE}>
            <span>{t('sound.db', { value: formatGain(EQ_MAX_GAIN) })}</span>
            <span>{t('sound.db', { value: formatGain(EQ_MIN_GAIN) })}</span>
          </span>
        )}
        {!full && lit !== null && (
          <span
            className="pointer-events-none absolute top-1.5 -translate-x-1/2 rounded-full bg-[rgb(var(--surface-hi))] px-1.5 text-[10.5px] font-semibold leading-[16px] tabular-nums text-ink"
            style={{ left: `clamp(18px, ${bandX(lit) * 100}%, calc(100% - 18px))` }}
          >
            {formatGain(gains[lit])}
          </span>
        )}
      </div>
      <div aria-hidden className="grid grid-cols-10">
        {EQ_LABELS.map((label, band) => (
          <span key={label} className="flex flex-col">
            {full && (
              <span
                className={`${GAIN} transition-colors ${
                  lit === band ? 'text-ink' : gains[band] === 0 ? 'text-ink-35' : 'text-ink-70'
                }`}
              >
                {formatGain(gains[band])}
              </span>
            )}
            <span
              className={`${BAND} transition-colors ${lit === band ? 'text-ink' : 'text-ink-35'}`}
            >
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
