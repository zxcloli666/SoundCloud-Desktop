import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CROSSFADE_MAX_SEC, useSettingsStore } from '../../../stores/settings';
import { RangeSlider } from '../primitives';

const WIDTH = 240;
const HEIGHT = 44;
const TOP = 6;
const BOTTOM = HEIGHT - 4;
const SAMPLES = 24;

function curve(from: number, to: number, gain: (t: number) => number): string {
  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const x = from + (to - from) * t;
    const y = BOTTOM - (BOTTOM - TOP) * gain(t);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' L');
}

function CrossfadeCurves({ seconds }: { seconds: number }) {
  const gradientId = useId();
  const half = (seconds / CROSSFADE_MAX_SEC) * (WIDTH * 0.42);
  const start = WIDTH / 2 - half;
  const end = WIDTH / 2 + half;
  const fadeOut = curve(start, end, (t) => Math.cos((t * Math.PI) / 2));
  const fadeIn = curve(start, end, (t) => Math.sin((t * Math.PI) / 2));
  const outgoing = `M0,${TOP} L${start.toFixed(1)},${TOP} L${fadeOut}`;
  const incoming = `M${start.toFixed(1)},${BOTTOM} L${fadeIn} L${WIDTH},${TOP}`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="w-full h-11 rounded-xl border border-white/[0.05] bg-white/[0.02]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {seconds > 0 && (
        <rect
          x={start}
          y={0}
          width={end - start}
          height={HEIGHT}
          fill="var(--color-accent-glow)"
          opacity={0.35}
        />
      )}
      <path d={`${incoming} L${WIDTH},${BOTTOM} Z`} fill={`url(#${gradientId})`} />
      <path
        d={outgoing}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={incoming}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function CrossfadePicker() {
  const { t } = useTranslation();
  const crossfadeSec = useSettingsStore((s) => s.crossfadeSec);
  const setCrossfadeSec = useSettingsStore((s) => s.setCrossfadeSec);
  const enabled = crossfadeSec > 0;

  return (
    <div className="space-y-3 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13.5px] text-white/80 font-medium">{t('settings.crossfade')}</div>
          <p className="text-[11.5px] text-white/35 mt-0.5 leading-snug">
            {enabled
              ? t('settings.crossfadeDesc', { count: crossfadeSec })
              : t('settings.crossfadeOffDesc')}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold tabular-nums transition-colors duration-200 ${
            enabled ? 'text-white' : 'text-white/35 bg-white/[0.03]'
          }`}
          style={enabled ? { background: 'var(--color-accent-glow)' } : undefined}
        >
          {enabled
            ? t('settings.crossfadeSeconds', { count: crossfadeSec })
            : t('settings.crossfadeOff')}
        </span>
      </div>
      <CrossfadeCurves seconds={crossfadeSec} />
      <RangeSlider
        value={crossfadeSec}
        min={0}
        max={CROSSFADE_MAX_SEC}
        step={1}
        onChange={setCrossfadeSec}
      />
    </div>
  );
}
