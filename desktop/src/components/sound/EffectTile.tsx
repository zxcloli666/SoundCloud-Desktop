import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from '../../lib/icons';
import type { EffectsPresetId } from '../../stores/effects';
import { EffectCanvas } from '../music/effects/EffectCanvas';
import type { Scene } from '../music/effects/scene';

export const EffectTile = memo(function EffectTile({
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
      data-ui="sound-effect"
      aria-checked={active}
      aria-label={t(`effects.preset.${id}`)}
      title={t(`effects.preset.${id}`)}
      tabIndex={focusable ? 0 : -1}
      onClick={() => onSelect(id)}
      className={`relative flex min-h-[76px] cursor-pointer flex-col overflow-hidden rounded-[14px] border outline-none transition-[background-color,border-color,transform] duration-200 ease-[var(--ease-apple)] focus-visible:ring-2 focus-visible:ring-accent/60 active:scale-[0.97] ${
        active
          ? id === 'off'
            ? 'border-ink/[0.22] bg-ink/[0.07]'
            : 'border-accent/55 bg-accent/[0.12]'
          : 'border-ink/[0.08] bg-ink/[0.025] hover:border-ink/[0.18] hover:bg-ink/[0.06]'
      }`}
    >
      <span className="relative min-h-0 flex-1">
        <EffectCanvas
          scene={scene}
          className={`absolute inset-0 size-full ${locked ? 'opacity-50' : active ? '' : 'opacity-80'}`}
        />
      </span>
      {locked && <Lock size={10} className="absolute right-2 top-2 text-ink-40" />}
      <span
        className={`flex h-[26px] w-full items-center justify-center px-1 text-[11px] font-semibold ${
          active ? 'text-ink' : 'text-ink-60'
        }`}
      >
        <span className="truncate">{t(`sound.fx.${id}`)}</span>
      </span>
    </button>
  );
});
