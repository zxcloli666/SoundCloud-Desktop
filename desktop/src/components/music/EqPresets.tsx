import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EQ_CUSTOM_PRESET_LIMIT, EQ_PRESET_NAME_MAX, EQ_PRESETS } from '../../lib/equalizer';
import { Check, Plus, X } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';

const chipClass = (active: boolean) =>
  `rounded-lg text-[11px] font-semibold transition-all duration-200 border ${
    active
      ? 'bg-white/[0.1] text-white/90 border-white/[0.12] shadow-sm'
      : 'bg-white/[0.02] text-white/35 border-white/[0.04] hover:bg-white/[0.06] hover:text-white/60'
  }`;

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
        className="mr-1 flex h-4 w-4 items-center justify-center rounded-md text-white/25 opacity-60 transition-all cursor-pointer hover:bg-white/[0.08] hover:text-red-400 group-hover/chip:opacity-100"
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
        className="h-8 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white/85 placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.18] focus:bg-white/[0.05]"
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
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/30 transition-all cursor-pointer hover:text-white/60"
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
  const deleteEqCustomPreset = useSettingsStore((s) => s.deleteEqCustomPreset);
  const [saving, setSaving] = useState(false);

  const isRu = i18n.language === 'ru';
  const limitReached = customPresets.length >= EQ_CUSTOM_PRESET_LIMIT;

  const handlePreset = useCallback(
    (id: string) => {
      const preset =
        EQ_PRESETS[id] ?? useSettingsStore.getState().eqCustomPresets.find((p) => p.id === id);
      if (!preset) return;
      setEqGains([...preset.gains]);
      setEqPreset(id);
    },
    [setEqGains, setEqPreset],
  );

  const stopSaving = useCallback(() => setSaving(false), []);

  return (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/30 font-medium">{t('eq.preset')}</p>
        <button
          type="button"
          disabled={limitReached && !saving}
          onClick={() => setSaving((v) => !v)}
          title={
            limitReached
              ? t('eq.presetLimit', { count: EQ_CUSTOM_PRESET_LIMIT })
              : t('eq.saveAsPreset')
          }
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-white/40 transition-all cursor-pointer hover:bg-white/[0.06] hover:text-white/75 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Plus size={12} />
          {t('eq.saveAsPreset')}
        </button>
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
          <PresetBtn id="custom" label={t('eq.custom')} active onClick={() => setSaving(true)} />
        )}
      </div>
      {customPresets.length > 0 && (
        <>
          <p className="mt-3.5 mb-2 text-[11px] text-white/30 font-medium">{t('eq.myPresets')}</p>
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
      {saving && <SavePresetForm onDone={stopSaving} />}
    </>
  );
});
