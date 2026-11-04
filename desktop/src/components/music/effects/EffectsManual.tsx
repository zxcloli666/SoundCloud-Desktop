import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FX_RANGE, setManualFx } from '../../../lib/effects';
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

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <EffectSlider
        label={t('effects.reverb')}
        readout={percent(reverb)}
        value={reverb}
        {...FX_RANGE.reverb}
        disabled={locked}
        onChange={(value) => setManualFx({ reverb: value })}
      />
      <EffectSlider
        label={t('effects.room')}
        readout={percent(room)}
        value={room}
        {...FX_RANGE.room}
        disabled={locked}
        onChange={(value) => setManualFx({ room: value })}
      />
      <EffectSlider
        label={t('effects.eightDSpeed')}
        readout={`${hz.toFixed(2)} Hz`}
        on={eightD}
        onSwitch={(on) => setManualFx({ eightD: on })}
        value={hz}
        {...FX_RANGE.eightDHz}
        disabled={locked}
        onChange={(value) => setManualFx({ eightDHz: value })}
      />
      <EffectSlider
        label={t('effects.bass')}
        readout={`+${bass.toFixed(1).replace(/\.0$/, '')} dB`}
        value={bass}
        {...FX_RANGE.bassDb}
        disabled={locked}
        onChange={(value) => setManualFx({ bassDb: value })}
      />
    </div>
  );
});
