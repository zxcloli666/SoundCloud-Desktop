import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EQ_PRESET_NAME_MAX } from '../../lib/equalizer';
import { Check, X } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';
import { FIELD, ICON_BTN, SUBMIT_BTN } from './styles';

export function SavePresetForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const save = useSettingsStore((s) => s.saveEqCustomPreset);
  const [name, setName] = useState('');
  const ready = name.trim().length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    save(name);
    onDone();
  };

  return (
    <form onSubmit={submit} data-ui="sound-eq-save" className="flex min-w-0 items-center gap-1">
      <input
        autoFocus
        value={name}
        maxLength={EQ_PRESET_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('eq.presetNamePlaceholder')}
        aria-label={t('eq.presetName')}
        className={`${FIELD} h-7 w-[220px] min-w-0 rounded-full px-3 text-[12px]`}
      />
      <button
        type="submit"
        disabled={!ready}
        title={t('eq.savePreset')}
        aria-label={t('eq.savePreset')}
        className={SUBMIT_BTN}
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={onDone}
        title={t('common.cancel')}
        aria-label={t('common.cancel')}
        className={ICON_BTN}
      >
        <X size={14} />
      </button>
    </form>
  );
}
