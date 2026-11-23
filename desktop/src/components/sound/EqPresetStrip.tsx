import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { applyEqPreset } from '../../lib/eq-presets';
import { EQ_PRESETS } from '../../lib/equalizer';
import { useSettingsStore } from '../../stores/settings';
import { revealChip, useChipScroller } from '../ui/useChipScroller';
import { chip } from './styles';

export function EqPresetStrip() {
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const on = useSettingsStore((s) => s.eqEnabled);
  const current = useSettingsStore((s) => s.eqPreset);
  const custom = useSettingsStore((s) => s.eqCustomPresets);
  const setEqEnabled = useSettingsStore((s) => s.setEqEnabled);
  const ru = i18n.language === 'ru';
  useChipScroller(ref);
  useEffect(() => {
    if (current) revealChip(ref.current, false);
  }, [current]);

  const presets = [
    ...Object.entries(EQ_PRESETS).map(([id, p]) => ({ id, name: ru ? p.labelRu : p.label })),
    ...custom,
  ];
  const pick = (id: string) => {
    setEqEnabled(true);
    applyEqPreset(id);
  };

  return (
    <div
      ref={ref}
      data-ui="sound-eq-presets"
      className="station-strip scrollbar-hide relative flex min-w-0 flex-1 gap-1.5 overflow-x-auto"
    >
      {presets.map(({ id, name }) => (
        <button
          key={id}
          type="button"
          aria-pressed={on && current === id}
          onClick={() => pick(id)}
          className={chip(on && current === id)}
        >
          {name}
        </button>
      ))}
      {current === 'custom' && (
        <button type="button" aria-pressed={on} disabled className={chip(on)}>
          {t('eq.custom')}
        </button>
      )}
    </div>
  );
}
