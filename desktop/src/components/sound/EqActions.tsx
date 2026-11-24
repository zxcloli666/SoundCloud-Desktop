import { useTranslation } from 'react-i18next';
import { applyEqPreset } from '../../lib/eq-presets';
import { EQ_CUSTOM_PRESET_LIMIT } from '../../lib/equalizer';
import { Download, Plus, RotateCcw, Upload } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';
import { chip, ICON_BTN } from './styles';

export type EqForm = 'save' | 'import' | 'export';

export function EqActions({
  form,
  onForm,
}: {
  form: EqForm | null;
  onForm: (form: EqForm | null) => void;
}) {
  const { t } = useTranslation();
  const changed = useSettingsStore(
    (s) => s.eqPreamp !== null || s.eqGains.some((gain) => gain !== 0),
  );
  const limited = useSettingsStore((s) => s.eqCustomPresets.length >= EQ_CUSTOM_PRESET_LIMIT);
  const flip = (next: EqForm) => onForm(form === next ? null : next);

  return (
    <div data-ui="sound-eq-actions" className="flex items-center gap-1">
      {changed && (
        <button
          type="button"
          onClick={() => applyEqPreset('flat')}
          title={t('eq.reset')}
          aria-label={t('eq.reset')}
          className={ICON_BTN}
        >
          <RotateCcw size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={() => flip('import')}
        title={t('eq.import')}
        aria-label={t('eq.import')}
        aria-pressed={form === 'import'}
        className={ICON_BTN}
      >
        <Download size={14} />
      </button>
      <button
        type="button"
        onClick={() => flip('export')}
        title={t('eq.export')}
        aria-label={t('eq.export')}
        aria-pressed={form === 'export'}
        className={ICON_BTN}
      >
        <Upload size={14} />
      </button>
      <button
        type="button"
        disabled={limited}
        onClick={() => onForm('save')}
        title={
          limited ? t('eq.presetLimit', { count: EQ_CUSTOM_PRESET_LIMIT }) : t('eq.saveAsPreset')
        }
        className={chip(false)}
      >
        <Plus size={12} />
        {t('eq.saveAsPreset')}
      </button>
    </div>
  );
}
