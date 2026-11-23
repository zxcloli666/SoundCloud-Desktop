import { useMemo } from 'react';
import { useEffectsStore } from '../../stores/effects';
import { usePlayerStore } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import { useSleepTimerStore } from '../../stores/sleep-timer';
import { presetRate } from '../effects';
import { usePremium } from '../premium-cache';
import { type SoundToken, soundTokens } from './live';

export function useSoundTokens(): SoundToken[] {
  const premium = usePremium();
  const enabled = useEffectsStore((s) => s.enabled);
  const preset = useEffectsStore((s) => s.preset);
  const eq = useSettingsStore((s) => s.eqEnabled);
  const rate = usePlayerStore((s) => s.playbackRate);
  const pitch = usePlayerStore((s) => (s.pitchControlMode === 'manual' ? s.pitchSemitones : null));
  const loop = usePlayerStore((s) => s.abLoop !== null);
  const sleep = useSleepTimerStore((s) => s.timer !== null);
  const fx = premium && enabled && preset !== 'off' ? preset : null;
  return useMemo(
    () => soundTokens({ fx, fxRate: fx ? presetRate(fx) : 1, eq, rate, pitch, loop, sleep }),
    [fx, eq, rate, pitch, loop, sleep],
  );
}
