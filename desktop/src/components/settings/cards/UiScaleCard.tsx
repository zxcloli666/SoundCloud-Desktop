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
      aria-pressed={active}
      title={value === UI_SCALE_DEFAULT ? t('settings.uiScaleDefault') : undefined}
      className={`flex flex-col items-center justify-end gap-1.5 rounded-2xl border px-2 pt-3 pb-2.5 transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
        active
          ? 'text-white'
          : 'text-white/45 hover:text-white/75 hover:bg-white/[0.05] border-white/[0.05] bg-white/[0.02]'
      }`}
      style={
        active
          ? {
              background:
                'linear-gradient(180deg, var(--color-accent-glow), transparent), rgba(255,255,255,0.05)',
              borderColor: 'var(--color-accent)',
              boxShadow: '0 0 16px var(--color-accent-glow)',
            }
          : undefined
      }
    >
      <span
        className="font-bold leading-none tracking-tight"
        style={{ fontSize: `${Math.round(15 * (value / 100))}px` }}
      >
        Aa
      </span>
      <span className="text-[11px] font-semibold tabular-nums">{value}%</span>
      <span
        className={`h-[3px] w-3 rounded-full ${value === UI_SCALE_DEFAULT ? 'bg-white/25' : 'bg-transparent'}`}
      />
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
        uiScale !== UI_SCALE_DEFAULT && (
          <button
            type="button"
            onClick={() => setUiScale(UI_SCALE_DEFAULT)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-semibold text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white cursor-pointer"
          >
            <RotateCcw size={12} />
            {t('settings.uiScaleReset')}
          </button>
        )
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
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[11.5px] text-white/40">
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
