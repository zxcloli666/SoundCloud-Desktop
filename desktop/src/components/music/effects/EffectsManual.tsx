import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FX_RANGE, setManualFx } from '../../../lib/effects';
import { formatGain } from '../../../lib/sound/live';
import { useEffectsStore } from '../../../stores/effects';
import { EffectSlider } from './EffectSlider';

const percent = (value: number) => `${Math.round(value * 100)}%`;

export const EffectsManual = memo(function EffectsManual({ locked }: { locked: boolean }) {
  const { t } = useTranslation();
  const reverb = useEffectsStore((s) => s.reverb);
  const room = useEffectsStore((s) => s.room);
  const hz = useEffectsStore((s) => s.eightDHz);
  const bass = useEffectsStore((s) => s.bassDb);
  const eightD = useEffectsStore((s) => s.eightD);
  const enabled = useEffectsStore((s) => s.enabled) && !locked;

  return (
    <div data-ui="sound-effects-manual" className="sound-manual grid gap-x-6 gap-y-2">
      <EffectSlider
        label={t('effects.reverb')}
        readout={percent(reverb)}
        value={reverb}
        {...FX_RANGE.reverb}
        lit={enabled && reverb > 0}
        disabled={locked}
        onChange={(value) => setManualFx({ reverb: value })}
      />
      <EffectSlider
        label={t('effects.room')}
        readout={percent(room)}
        value={room}
        {...FX_RANGE.room}
        lit={enabled && reverb > 0}
        disabled={locked}
        onChange={(value) => setManualFx({ room: value })}
      />
      <EffectSlider
        label={t('effects.eightDSpeed')}
        readout={t('sound.hz', { value: hz.toFixed(2) })}
        on={eightD}
        onSwitch={(on) => setManualFx({ eightD: on })}
        value={hz}
        {...FX_RANGE.eightDHz}
        lit={enabled && eightD}
        disabled={locked}
        onChange={(value) => setManualFx({ eightDHz: value })}
      />
      <EffectSlider
        label={t('effects.bass')}
        readout={t('sound.db', { value: formatGain(bass) })}
        value={bass}
        {...FX_RANGE.bassDb}
        lit={enabled && bass > 0}
        disabled={locked}
        onChange={(value) => setManualFx({ bassDb: value })}
      />
    </div>
  );
});
