import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settings';
import { toggleSection } from '../../stores/sound-window';
import { Toggle } from '../settings/primitives';
import { EqActions, type EqForm } from './EqActions';
import { EqCurve } from './EqCurve';
import { EqPreamp } from './EqPreamp';
import { EqPresets } from './EqPresets';
import { EqExportForm, EqImportForm } from './EqTransfer';
import { ExpandBtn } from './ExpandBtn';
import { SavePresetForm } from './SavePresetForm';
import { LABEL } from './styles';

export const EqSection = memo(function EqSection({ full }: { full: boolean }) {
  const { t } = useTranslation();
  const on = useSettingsStore((s) => s.eqEnabled);
  const setEqEnabled = useSettingsStore((s) => s.setEqEnabled);
  const [form, setForm] = useState<EqForm | null>(null);
  const close = () => setForm(null);
  const toggle = () => {
    close();
    toggleSection('eq');
  };

  return (
    <div
      role="group"
      data-ui="sound-eq"
      aria-label={t('eq.title')}
      className="flex min-h-0 min-w-0 flex-col gap-2.5"
    >
      <div className="flex h-7 items-center gap-1.5">
        <span className={LABEL}>{t('eq.title')}</span>
        <span className="flex-1" />
        {full && form === 'save' && <SavePresetForm onDone={close} />}
        {full && form !== 'save' && <EqActions form={form} onForm={setForm} />}
        <ExpandBtn full={full} onClick={toggle} />
        <Toggle checked={on} onChange={() => setEqEnabled(!on)} label={t('eq.title')} />
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        {full && <EqPreamp />}
        <EqCurve full={full} />
      </div>
      {form === 'import' && <EqImportForm onDone={close} />}
      {form === 'export' && <EqExportForm onDone={close} />}
      {(form === null || form === 'save') && (
        <EqPresets full={full} onSave={() => setForm('save')} />
      )}
    </div>
  );
});
