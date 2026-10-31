import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EQ_CUSTOM_PRESET_LIMIT, EQ_PRESET_NAME_MAX, EQ_PRESETS } from '../../lib/equalizer';
import { Check, Download, Plus, Upload, X } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';
import { EqExportForm, EqImportForm } from './EqTransfer';

const chipClass = (active: boolean) =>
  `rounded-lg text-[11px] font-semibold transition-all duration-200 border ${
    active
      ? 'bg-ink/[0.1] text-ink-90 border-ink/[0.12] shadow-sm'
      : 'bg-ink/[0.02] text-ink-35 border-ink/[0.04] hover:bg-ink/[0.06] hover:text-ink-60'
  }`;

const panelButtonClass =
  'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

const panelButtonState = (open: boolean) =>
  open
    ? 'bg-ink/[0.08] text-ink-80'
    : 'text-ink-40 hover:bg-ink/[0.06] hover:text-ink-75';

const PresetBtn = React.memo(function PresetBtn({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`px-3 py-1.5 cursor-pointer ${chipClass(active)}`}
    >
      {label}
    </button>
  );
});

const CustomPresetChip = React.memo(function CustomPresetChip({
  id,
  name,
  active,
  onSelect,
  onDelete,
}: {
  id: string;
  name: string;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <span className={`group/chip inline-flex items-center ${chipClass(active)}`}>
      <button
        type="button"
        onClick={() => onSelect(id)}
        className="max-w-[160px] truncate py-1.5 pl-3 pr-1.5 cursor-pointer"
      >
        {name}
      </button>
      <button
        type="button"
        title={t('eq.deletePreset')}
        aria-label={t('eq.deletePreset')}
        onClick={() => onDelete(id)}
        className="mr-1 flex h-4 w-4 items-center justify-center rounded-md text-ink-25 opacity-60 transition-all cursor-pointer hover:bg-ink/[0.08] hover:text-red-400 group-hover/chip:opacity-100"
      >
        <X size={10} />
      </button>
    </span>
  );
});

const SavePresetForm = React.memo(function SavePresetForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const saveEqCustomPreset = useSettingsStore((s) => s.saveEqCustomPreset);
  const [name, setName] = useState('');
  const canSave = name.trim().length > 0;

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSave) return;
      saveEqCustomPreset(name);
      onDone();
    },
    [canSave, name, saveEqCustomPreset, onDone],
  );

  return (
    <form onSubmit={submit} className="mt-2.5 flex items-center gap-1.5 animate-fade-in-up">
      <input
        autoFocus
        value={name}
        maxLength={EQ_PRESET_NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('eq.presetNamePlaceholder')}
        aria-label={t('eq.presetName')}
        className="h-8 min-w-0 flex-1 rounded-lg border border-ink/[0.08] bg-ink/[0.03] px-3 text-[12px] text-ink-85 placeholder:text-ink-25 outline-none transition-colors focus:border-ink/[0.18] focus:bg-ink/[0.05]"
      />
      <button
        type="submit"
        disabled={!canSave}
        title={t('eq.savePreset')}
        aria-label={t('eq.savePreset')}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/15 text-emerald-400 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={onDone}
        title={t('common.cancel')}
        aria-label={t('common.cancel')}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/[0.06] bg-ink/[0.04] text-ink-30 transition-all cursor-pointer hover:text-ink-60"
      >
        <X size={14} />
      </button>
    </form>
  );
});

export const EqPresets = React.memo(function EqPresets() {
  const { t, i18n } = useTranslation();
  const eqPreset = useSettingsStore((s) => s.eqPreset);
  const customPresets = useSettingsStore((s) => s.eqCustomPresets);
  const setEqGains = useSettingsStore((s) => s.setEqGains);
  const setEqPreset = useSettingsStore((s) => s.setEqPreset);
  const setEqPreamp = useSettingsStore((s) => s.setEqPreamp);
  const deleteEqCustomPreset = useSettingsStore((s) => s.deleteEqCustomPreset);
  const [panel, setPanel] = useState<'save' | 'import' | 'export' | null>(null);

  const isRu = i18n.language === 'ru';
  const limitReached = customPresets.length >= EQ_CUSTOM_PRESET_LIMIT;

  const handlePreset = useCallback(
    (id: string) => {
      const custom = useSettingsStore.getState().eqCustomPresets.find((p) => p.id === id);
      const preset = EQ_PRESETS[id] ?? custom;
      if (!preset) return;
      setEqGains([...preset.gains]);
      setEqPreamp(custom?.preamp ?? null);
      setEqPreset(id);
    },
    [setEqGains, setEqPreamp, setEqPreset],
  );

  const closePanel = useCallback(() => setPanel(null), []);
  const togglePanel = (next: 'save' | 'import' | 'export') =>
    setPanel((current) => (current === next ? null : next));

  return (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-ink-30 font-medium">{t('eq.preset')}</p>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => togglePanel('import')}
            title={t('eq.import')}
            aria-label={t('eq.import')}
            aria-pressed={panel === 'import'}
            className={`${panelButtonClass} ${panelButtonState(panel === 'import')}`}
          >
            <Download size={12} />
          </button>
          <button
            type="button"
            onClick={() => togglePanel('export')}
            title={t('eq.export')}
            aria-label={t('eq.export')}
            aria-pressed={panel === 'export'}
            className={`${panelButtonClass} ${panelButtonState(panel === 'export')}`}
          >
            <Upload size={12} />
          </button>
          <button
            type="button"
            disabled={limitReached && panel !== 'save'}
            onClick={() => togglePanel('save')}
            title={
              limitReached
                ? t('eq.presetLimit', { count: EQ_CUSTOM_PRESET_LIMIT })
                : t('eq.saveAsPreset')
            }
            className={`${panelButtonClass} ${panelButtonState(panel === 'save')}`}
          >
            <Plus size={12} />
            {t('eq.saveAsPreset')}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(EQ_PRESETS).map(([id, preset]) => (
          <PresetBtn
            key={id}
            id={id}
            label={isRu ? preset.labelRu : preset.label}
            active={eqPreset === id}
            onClick={handlePreset}
          />
        ))}
        {eqPreset === 'custom' && (
          <PresetBtn id="custom" label={t('eq.custom')} active onClick={() => setPanel('save')} />
        )}
      </div>
      {customPresets.length > 0 && (
        <>
          <p className="mt-3.5 mb-2 text-[11px] text-ink-30 font-medium">{t('eq.myPresets')}</p>
          <div className="flex flex-wrap gap-1.5">
            {customPresets.map((preset) => (
              <CustomPresetChip
                key={preset.id}
                id={preset.id}
                name={preset.name}
                active={eqPreset === preset.id}
                onSelect={handlePreset}
                onDelete={deleteEqCustomPreset}
              />
            ))}
          </div>
        </>
      )}
      {panel === 'save' && <SavePresetForm onDone={closePanel} />}
      {panel === 'import' && <EqImportForm onDone={closePanel} />}
      {panel === 'export' && <EqExportForm onDone={closePanel} />}
    </>
  );
});
