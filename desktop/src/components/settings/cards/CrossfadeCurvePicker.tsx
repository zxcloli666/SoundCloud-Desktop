import { useTranslation } from 'react-i18next';
import {
  CROSSFADE_CURVES,
  type CrossfadeCurve,
  incomingGain,
  outgoingGain,
} from '../../../lib/crossfade-curve';
import { useSettingsStore } from '../../../stores/settings';
import { Row } from '../primitives';
import { curvePath } from './crossfade-path';

const WIDTH = 56;
const HEIGHT = 28;
const EDGE = 3;

const LABEL_KEYS: Record<CrossfadeCurve, string> = {
  equal_power: 'settings.crossfadeCurveEqualPower',
  linear: 'settings.crossfadeCurveLinear',
  smooth: 'settings.crossfadeCurveSmooth',
};

function CurvePreview({ curve, active }: { curve: CrossfadeCurve; active: boolean }) {
  const draw = (gain: (progress: number) => number) =>
    `M${curvePath(EDGE, WIDTH - EDGE, EDGE, HEIGHT - EDGE, gain)}`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      fill="none"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={draw((t) => outgoingGain(curve, t))} className="stroke-ink/35" />
      <path
        d={draw((t) => incomingGain(curve, t))}
        className={active ? 'stroke-accent' : 'stroke-ink/60'}
      />
    </svg>
  );
}

export function CrossfadeCurvePicker() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.crossfadeSec > 0);
  const chosen = useSettingsStore((s) => s.crossfadeCurve);
  const setCrossfadeCurve = useSettingsStore((s) => s.setCrossfadeCurve);

  return (
    <Row title={t('settings.crossfadeCurve')}>
      <div
        data-ui="segmented"
        role="radiogroup"
        aria-label={t('settings.crossfadeCurve')}
        className={`set-seg max-w-full transition-opacity duration-200 ${enabled ? '' : 'opacity-50'}`}
      >
        {CROSSFADE_CURVES.map((curve) => {
          const active = curve === chosen;
          return (
            <button
              key={curve}
              type="button"
              role="radio"
              aria-checked={active}
              data-ui="segment"
              data-value={curve}
              data-active={active ? 'true' : 'false'}
              onClick={() => setCrossfadeCurve(curve)}
              className="set-seg-item h-auto flex-col gap-1.5 py-2"
            >
              <CurvePreview curve={curve} active={active} />
              <span className="max-w-full truncate">{t(LABEL_KEYS[curve])}</span>
            </button>
          );
        })}
      </div>
    </Row>
  );
}
