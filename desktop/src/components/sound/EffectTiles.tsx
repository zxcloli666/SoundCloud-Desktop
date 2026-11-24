import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { selectPreset } from '../../lib/effects';
import { type EffectsPresetId, useEffectsStore } from '../../stores/effects';
import { openSound } from '../../stores/sound-window';
import { EFFECT_CARDS, presetScene } from '../music/effects/presets';
import { moveRadioFocus } from '../music/effects/radio-focus';
import type { Scene } from '../music/effects/scene';
import { EffectTile } from './EffectTile';

export const EffectTiles = memo(function EffectTiles({
  locked,
  full,
}: {
  locked: boolean;
  full: boolean;
}) {
  const { t } = useTranslation();
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
    const allowed = !locked || id === 'off';
    if (allowed) selectPreset(id);
    if (!allowed || id === 'custom') openSound('effects');
  };

  return (
    <div
      role="radiogroup"
      data-ui="sound-effects"
      aria-label={t('effects.title')}
      onKeyDown={moveRadioFocus}
      className={`grid gap-2 ${full ? 'grid-cols-6' : 'min-h-0 flex-1 auto-rows-fr grid-cols-3'}`}
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
  );
});
