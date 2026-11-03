import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from '../../../lib/icons';
import type { EffectsPresetId } from '../../../stores/effects';
import { EffectCanvas } from './EffectCanvas';
import type { Scene } from './scene';

export const EffectCard = memo(function EffectCard({
  id,
  scene,
  active,
  locked,
  focusable,
  onSelect,
}: {
  id: EffectsPresetId;
  scene: Scene;
  active: boolean;
  locked: boolean;
  focusable: boolean;
  onSelect: (id: EffectsPresetId) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-disabled={locked}
      tabIndex={focusable ? 0 : -1}
      onClick={() => !locked && onSelect(id)}
      className={`group/card relative overflow-hidden rounded-2xl border text-left outline-none transition-all duration-500 ease-[var(--ease-apple)] focus-visible:ring-2 focus-visible:ring-accent/60 ${
        locked ? 'cursor-default' : 'cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]'
      } ${
        active
          ? 'border-accent/45 bg-accent/[0.08] shadow-[0_0_28px_-8px_var(--color-accent-glow)]'
          : 'border-ink/[0.07] bg-ink/[0.03] hover:border-ink/[0.14] hover:bg-ink/[0.05]'
      }`}
    >
      <EffectCanvas
        scene={scene}
        className={`block h-[70px] w-full transition-opacity duration-500 ${
          locked ? 'opacity-60' : 'opacity-100'
        }`}
      />
      <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
        <span
          className={`truncate text-[12px] font-semibold transition-colors duration-300 ${
            active ? 'text-ink-90' : 'text-ink-60'
          }`}
        >
          {t(`effects.preset.${id}`)}
        </span>
        {locked && <Lock size={11} className="shrink-0 text-ink-35" />}
        {active && !locked && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
        )}
      </div>
    </button>
  );
});
