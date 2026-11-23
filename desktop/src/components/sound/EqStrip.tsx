import { useTranslation } from 'react-i18next';
import { Maximize2 } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';
import { Toggle } from '../settings/primitives';
import { EqCurve } from './EqCurve';
import { EqPresetStrip } from './EqPresetStrip';
import { ICON_BTN, LABEL } from './styles';

export function EqStrip({ onFull }: { onFull: () => void }) {
  const { t } = useTranslation();
  const on = useSettingsStore((s) => s.eqEnabled);
  const setEqEnabled = useSettingsStore((s) => s.setEqEnabled);
  return (
    <div
      role="group"
      data-ui="sound-eq"
      aria-label={t('eq.title')}
      className="flex min-w-0 flex-col gap-2"
    >
      <div className="flex items-center gap-2.5">
        <span className={LABEL}>{t('eq.title')}</span>
        <EqPresetStrip />
        <button
          type="button"
          onClick={onFull}
          title={t('eq.title')}
          aria-label={t('eq.title')}
          className={ICON_BTN}
        >
          <Maximize2 size={13} />
        </button>
        <Toggle checked={on} onChange={() => setEqEnabled(!on)} label={t('eq.title')} />
      </div>
      <EqCurve />
    </div>
  );
}
