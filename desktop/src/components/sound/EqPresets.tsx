import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { applyEqPreset } from '../../lib/eq-presets';
import { EQ_PRESETS } from '../../lib/equalizer';
import { X } from '../../lib/icons';
import { useSettingsStore } from '../../stores/settings';
import { revealChip, useChipScroller } from '../ui/useChipScroller';
import { chip } from './styles';

const STRIP = 'station-strip scrollbar-hide overflow-x-auto';
const WALL = 'max-h-[96px] flex-wrap overflow-y-auto';

function OwnPreset({
  name,
  on,
  onPick,
  onDelete,
}: {
  name: string;
  on: boolean;
  onPick: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <span className={`${chip(on)} pr-1`}>
      <button
        type="button"
        aria-pressed={on}
        onClick={onPick}
        className="max-w-[160px] cursor-pointer truncate outline-none focus-visible:underline"
      >
        {name}
      </button>
      <button
        type="button"
        onClick={onDelete}
        title={t('eq.deletePreset')}
        aria-label={t('eq.deletePreset')}
        className="flex size-[18px] cursor-pointer items-center justify-center rounded-full text-ink-35 outline-none transition-colors hover:bg-bad/15 hover:text-bad focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <X size={11} />
      </button>
    </span>
  );
}

export const EqPresets = memo(function EqPresets({
  full,
  onSave,
}: {
  full: boolean;
  onSave: () => void;
}) {
  const { t, i18n } = useTranslation();
  const row = useRef<HTMLDivElement>(null);
  const on = useSettingsStore((s) => s.eqEnabled);
  const current = useSettingsStore((s) => s.eqPreset);
  const own = useSettingsStore((s) => s.eqCustomPresets);
  const setEqEnabled = useSettingsStore((s) => s.setEqEnabled);
  const deletePreset = useSettingsStore((s) => s.deleteEqCustomPreset);
  const ru = i18n.language === 'ru';
  useChipScroller(row);
  useEffect(() => {
    if (current && !full) revealChip(row.current, false);
  }, [current, full]);

  const lit = (id: string) => on && current === id;
  const pick = (id: string) => {
    setEqEnabled(true);
    applyEqPreset(id);
  };
  const preset = (id: string, name: string) => (
    <button
      key={id}
      type="button"
      aria-pressed={lit(id)}
      onClick={() => pick(id)}
      className={chip(lit(id))}
    >
      {name}
    </button>
  );

  return (
    <div
      ref={row}
      data-ui="sound-eq-presets"
      className={`relative flex min-w-0 shrink-0 gap-1.5 ${full ? WALL : STRIP}`}
    >
      {Object.entries(EQ_PRESETS).map(([id, p]) => preset(id, ru ? p.labelRu : p.label))}
      {own.map(({ id, name }) =>
        full ? (
          <OwnPreset
            key={id}
            name={name}
            on={lit(id)}
            onPick={() => pick(id)}
            onDelete={() => deletePreset(id)}
          />
        ) : (
          preset(id, name)
        ),
      )}
      {current === 'custom' && (
        <button
          type="button"
          aria-pressed={on}
          disabled={!full}
          onClick={onSave}
          className={chip(on)}
        >
          {t('eq.custom')}
        </button>
      )}
    </div>
  );
});
