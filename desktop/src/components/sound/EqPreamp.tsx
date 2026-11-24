import * as Slider from '@radix-ui/react-slider';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackedInvoke as invoke } from '../../lib/diagnostics';
import { EQ_PREAMP_MAX, EQ_PREAMP_MIN } from '../../lib/equalizer';
import { formatGain } from '../../lib/sound/live';
import { useWheelStep } from '../../lib/useWheelStep';
import { useSettingsStore } from '../../stores/settings';
import { BAND, GAIN } from './styles';

const STEP = 0.5;
const place = (gain: number) => ((gain - EQ_PREAMP_MIN) / (EQ_PREAMP_MAX - EQ_PREAMP_MIN)) * 100;
const span = (from: number, to: number) => ({
  bottom: `${Math.min(place(from), place(to))}%`,
  top: `${100 - Math.max(place(from), place(to))}%`,
});

function useSafePreamp() {
  const gains = useSettingsStore((s) => s.eqGains);
  const [safe, setSafe] = useState(0);
  useEffect(() => {
    let alive = true;
    invoke<number>('audio_eq_auto_preamp', { gains })
      .then((value) => {
        if (alive) setSafe(value);
      })
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, [gains]);
  return safe;
}

export const EqPreamp = memo(function EqPreamp() {
  const { t } = useTranslation();
  const slider = useRef<HTMLSpanElement>(null);
  const on = useSettingsStore((s) => s.eqEnabled);
  const preamp = useSettingsStore((s) => s.eqPreamp);
  const setEqPreamp = useSettingsStore((s) => s.setEqPreamp);
  const setEqEnabled = useSettingsStore((s) => s.setEqEnabled);
  const safe = useSafePreamp();
  const auto = preamp === null;
  const value = preamp ?? safe;
  const clipping = value > safe;

  const change = (next: number) => {
    if (!on) setEqEnabled(true);
    setEqPreamp(Math.max(EQ_PREAMP_MIN, Math.min(EQ_PREAMP_MAX, next)));
  };
  useWheelStep(slider, (direction) => change(Math.round(value / STEP + direction) * STEP));

  return (
    <div
      data-ui="sound-preamp"
      data-clipping={clipping ? '' : undefined}
      className={`flex w-[52px] shrink-0 flex-col items-center gap-1.5 transition-opacity duration-300 ${
        on ? '' : 'opacity-50'
      }`}
    >
      <button
        type="button"
        onClick={() => setEqPreamp(null)}
        aria-pressed={auto}
        title={t('eq.preampAuto')}
        className={`h-[18px] shrink-0 cursor-pointer rounded-full px-1.5 text-[10px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 ${
          auto
            ? 'bg-ink/[0.12] text-ink'
            : clipping
              ? 'bg-bad/15 text-bad hover:bg-bad/25'
              : 'text-ink-35 hover:text-ink-70'
        }`}
      >
        {t('eq.auto')}
      </button>
      <Slider.Root
        ref={slider}
        orientation="vertical"
        aria-label={t('eq.preamp')}
        value={[value]}
        min={EQ_PREAMP_MIN}
        max={EQ_PREAMP_MAX}
        step={STEP}
        onValueChange={([next]) => change(next)}
        className="relative flex min-h-0 w-7 flex-1 cursor-pointer touch-none select-none flex-col items-center"
      >
        <Slider.Track className="relative w-[3px] grow rounded-full bg-ink/[0.1]">
          <span
            className={`absolute w-full rounded-full ${auto ? 'bg-ink/40' : 'bg-accent'}`}
            style={span(0, value)}
          />
          {clipping && (
            <span className="absolute w-full rounded-full bg-bad" style={span(safe, value)} />
          )}
          <span
            className="absolute left-1/2 h-px w-2 -translate-x-1/2 bg-ink/25"
            style={{ bottom: `${place(0)}%` }}
          />
        </Slider.Track>
        <Slider.Thumb
          className={`block size-3 rounded-full border-2 outline-none transition-transform duration-150 hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-accent/50 ${
            auto
              ? 'border-ink/55 bg-surface-hi'
              : clipping
                ? 'border-bad bg-bad'
                : 'border-accent bg-accent'
          }`}
        />
      </Slider.Root>
      <div className="flex flex-col">
        <span className={`${GAIN} ${clipping ? 'text-bad' : 'text-ink-70'}`}>
          {formatGain(value)}
        </span>
        <span className={`${BAND} text-ink-35`}>{t('eq.preamp')}</span>
      </div>
    </div>
  );
});
