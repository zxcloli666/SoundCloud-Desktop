import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { type CrossfadeCurve, incomingGain, outgoingGain } from '../../../lib/crossfade-curve';
import { CROSSFADE_MAX_SEC, useSettingsStore } from '../../../stores/settings';
import { RangeSlider, Row } from '../primitives';
import { curvePath } from './crossfade-path';

const WIDTH = 240;
const HEIGHT = 44;
const TOP = 6;
const BOTTOM = HEIGHT - 4;

function CrossfadeCurves({ seconds, curve }: { seconds: number; curve: CrossfadeCurve }) {
  const gradientId = useId();
  const half = (seconds / CROSSFADE_MAX_SEC) * (WIDTH * 0.42);
  const start = WIDTH / 2 - half;
  const end = WIDTH / 2 + half;
  const fadeOut = curvePath(start, end, TOP, BOTTOM, (t) => outgoingGain(curve, t));
  const fadeIn = curvePath(start, end, TOP, BOTTOM, (t) => incomingGain(curve, t));
  const outgoing = `M0,${TOP} L${start.toFixed(1)},${TOP} L${fadeOut}`;
  const incoming = `M${start.toFixed(1)},${BOTTOM} L${fadeIn} L${WIDTH},${TOP}`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-11 w-full rounded-[10px] border border-[color:var(--set-line)] bg-[var(--set-well)]"
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
        className="stroke-ink/35"
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
  const crossfadeCurve = useSettingsStore((s) => s.crossfadeCurve);
  const setCrossfadeSec = useSettingsStore((s) => s.setCrossfadeSec);
  const enabled = crossfadeSec > 0;

  return (
    <Row
      stacked
      title={t('settings.crossfade')}
      value={
        <span
          className={`set-chip min-w-[52px] justify-center ${enabled ? 'text-ink' : 'text-ink-45'}`}
          style={enabled ? { background: 'var(--color-accent-glow)' } : undefined}
        >
          {enabled
            ? t('settings.crossfadeSeconds', { count: crossfadeSec })
            : t('settings.crossfadeOff')}
        </span>
      }
      info={
        enabled
          ? t('settings.crossfadeDesc', { count: crossfadeSec })
          : t('settings.crossfadeOffDesc')
      }
    >
      <div className="space-y-3">
        <CrossfadeCurves seconds={crossfadeSec} curve={crossfadeCurve} />
        <RangeSlider
          value={crossfadeSec}
          min={0}
          max={CROSSFADE_MAX_SEC}
          step={1}
          onChange={setCrossfadeSec}
        />
      </div>
    </Row>
  );
}
