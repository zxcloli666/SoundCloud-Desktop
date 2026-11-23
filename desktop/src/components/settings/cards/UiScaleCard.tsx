import { useTranslation } from 'react-i18next';
import { Fullscreen, RotateCcw } from '../../../lib/icons';
import { isMac } from '../../../lib/platform';
import {
  clampUiScale,
  UI_SCALE_DEFAULT,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
} from '../../../lib/ui-scale';
import { useSettingsStore } from '../../../stores/settings';
import { KeyCaps } from '../../ui/KeyCap';
import { Card } from '../primitives';

const PRESETS = Array.from(
  { length: (UI_SCALE_MAX - UI_SCALE_MIN) / UI_SCALE_STEP + 1 },
  (_, i) => UI_SCALE_MIN + i * UI_SCALE_STEP,
);

function ScalePreset({
  value,
  active,
  onSelect,
}: {
  value: number;
  active: boolean;
  onSelect: (value: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      data-active={active}
      aria-pressed={active}
      title={value === UI_SCALE_DEFAULT ? t('settings.uiScaleDefault') : undefined}
      className="set-tile items-center"
    >
      <span className="set-tile-art flex h-10 w-full items-end justify-center pb-1 text-ink-85">
        <span
          className="font-semibold leading-none tracking-tight"
          style={{ fontSize: `${Math.round(16 * (value / 100))}px` }}
        >
          Aa
        </span>
      </span>
      <span className="set-tile-label flex items-center justify-center gap-1 tabular-nums">
        {value}%{value === UI_SCALE_DEFAULT && <span className="h-1 w-1 rounded-full bg-ink/40" />}
      </span>
    </button>
  );
}

export function UiScaleCard() {
  const { t } = useTranslation();
  const uiScale = clampUiScale(useSettingsStore((s) => s.uiScale));
  const setUiScale = useSettingsStore((s) => s.setUiScale);
  const mod = isMac() ? '⌘' : 'Ctrl';

  return (
    <Card
      title={t('settings.uiScale')}
      desc={t('settings.uiScaleDesc')}
      icon={<Fullscreen size={17} />}
      action={
        <button
          type="button"
          onClick={() => setUiScale(UI_SCALE_DEFAULT)}
          disabled={uiScale === UI_SCALE_DEFAULT}
          className="set-btn"
          data-tone="quiet"
        >
          <RotateCcw size={13} />
          {t('settings.uiScaleReset')}
        </button>
      }
    >
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${PRESETS.length}, minmax(0,1fr))` }}
      >
        {PRESETS.map((value) => (
          <ScalePreset key={value} value={value} active={value === uiScale} onSelect={setUiScale} />
        ))}
      </div>
      <div className="set-row flex flex-wrap items-center gap-x-5 gap-y-2 py-3 text-[12px] text-ink-45">
        <span className="inline-flex items-center gap-2">
          <KeyCaps labels={[mod, '+']} size="sm" />
          <KeyCaps labels={[mod, '−']} size="sm" />
          {t('settings.uiScaleKeysStep')}
        </span>
        <span className="inline-flex items-center gap-2">
          <KeyCaps labels={[mod, '0']} size="sm" />
          {t('settings.uiScaleKeysReset')}
        </span>
        <span className="inline-flex items-center gap-2">
          <KeyCaps labels={[mod, t('settings.uiScaleWheel')]} size="sm" />
          {t('settings.uiScaleKeysWheel')}
        </span>
      </div>
    </Card>
  );
}
