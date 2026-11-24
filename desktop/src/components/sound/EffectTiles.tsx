import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { selectPreset } from '../../lib/effects';
import { Maximize2 } from '../../lib/icons';
import { usePremium } from '../../lib/premium-cache';
import { type EffectsPresetId, useEffectsStore } from '../../stores/effects';
import { EFFECT_CARDS, presetScene } from '../music/effects/presets';
import { moveRadioFocus } from '../music/effects/radio-focus';
import type { Scene } from '../music/effects/scene';
import { EffectTile } from './EffectTile';
import { ICON_BTN, LABEL } from './styles';

export const EffectTiles = memo(function EffectTiles({ onFull }: { onFull: () => void }) {
  const { t } = useTranslation();
  const locked = !usePremium();
  const enabled = useEffectsStore((s) => s.enabled);
  const preset = useEffectsStore((s) => s.preset);
  const reverb = useEffectsStore((s) => s.reverb);
  const room = useEffectsStore((s) => s.room);
  const eightD = useEffectsStore((s) => s.eightD);
  const eightDHz = useEffectsStore((s) => s.eightDHz);
  const bassDb = useEffectsStore((s) => s.bassDb);

  const scenes = useMemo(
    () =>
      Object.fromEntries(
        EFFECT_CARDS.map((id) => [
          id,
          id === 'custom' ? { reverb, room, eightD, eightDHz, bassDb, rate: 1 } : presetScene(id),
        ]),
      ) as Record<EffectsPresetId, Scene>,
    [reverb, room, eightD, eightDHz, bassDb],
  );
  const current = enabled && !locked ? preset : 'off';
  const pick = (id: EffectsPresetId) => {
    if (locked && id !== 'off') return onFull();
    selectPreset(id);
    if (id === 'custom') onFull();
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex h-7 items-center justify-between">
        <span className={LABEL}>{t('effects.title')}</span>
        <button
          type="button"
          onClick={onFull}
          title={t('effects.title')}
          aria-label={t('effects.title')}
          className={ICON_BTN}
        >
          <Maximize2 size={13} />
        </button>
      </div>
      <div
        role="radiogroup"
        data-ui="sound-effects"
        aria-label={t('effects.title')}
        onKeyDown={moveRadioFocus}
        className="grid flex-1 grid-cols-3 gap-2"
      >
        {EFFECT_CARDS.map((id) => (
          <EffectTile
            key={id}
            id={id}
            scene={scenes[id]}
            active={current === id}
            locked={locked && id !== 'off'}
            focusable={current === id}
            onSelect={pick}
          />
        ))}
      </div>
    </div>
  );
});
