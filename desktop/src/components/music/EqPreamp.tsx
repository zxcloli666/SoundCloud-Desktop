import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackedInvoke as invoke } from '../../lib/diagnostics';
import { EQ_PREAMP_MAX, EQ_PREAMP_MIN } from '../../lib/equalizer';
import { useSettingsStore } from '../../stores/settings';
import { EqSlider } from './EqSlider';

export const EqPreamp = React.memo(function EqPreamp() {
  const { t } = useTranslation();
  const gains = useSettingsStore((s) => s.eqGains);
  const preamp = useSettingsStore((s) => s.eqPreamp);
  const setEqPreamp = useSettingsStore((s) => s.setEqPreamp);
  const [autoValue, setAutoValue] = useState(0);
  const auto = preamp === null;

  useEffect(() => {
    if (!auto) return;
    let alive = true;
    invoke<number>('audio_eq_auto_preamp', { gains })
      .then((value) => {
        if (alive) setAutoValue(value);
      })
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, [auto, gains]);

  const handleChange = useCallback(
    (_index: number, value: number) => setEqPreamp(value),
    [setEqPreamp],
  );

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => setEqPreamp(null)}
        aria-pressed={auto}
        title={t('eq.preampAuto')}
        className={`h-4 rounded-md px-1.5 text-[9px] font-semibold uppercase tracking-wide transition-colors cursor-pointer border ${
          auto
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
            : 'bg-ink/[0.03] text-ink-30 border-ink/[0.06] hover:text-ink-60'
        }`}
      >
        {t('eq.auto')}
      </button>
      <EqSlider
        index={0}
        value={preamp ?? autoValue}
        min={EQ_PREAMP_MIN}
        max={EQ_PREAMP_MAX}
        label={t('eq.preamp')}
        hollow={auto}
        onChange={handleChange}
      />
    </div>
  );
});
