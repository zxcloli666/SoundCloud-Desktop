import { type EffectsPresetId, useEffectsStore } from '../../../stores/effects';
import { useSleepTimerStore } from '../../../stores/sleep-timer';
import { type SoundSection, showSound } from '../../../stores/sound-window';
import { selectPreset } from '../../effects';
import { cancelSleepTimer, startSleepAtTrackEnd, startSleepTimer } from '../../sleep-timer';
import type { SleepShown } from './context';
import type { EffectName, SleepPlan, SoundView } from './ports';

const PRESETS: Record<EffectName, EffectsPresetId> = {
  off: 'off',
  slowed_reverb: 'slowedReverb',
  sped_up: 'spedUp',
  eight_d: 'eightD',
  bass: 'bass',
};

const SECTIONS: Record<SoundView, SoundSection> = {
  all: 'main',
  equalizer: 'eq',
  effects: 'effects',
};

export function setSleep(plan: SleepPlan) {
  if (plan === 'off') cancelSleepTimer();
  else if (plan === 'track_end') startSleepAtTrackEnd();
  else startSleepTimer(plan.minutes);
}

export function setEffect(effect: EffectName) {
  selectPreset(PRESETS[effect]);
}

export function showSoundView(view: SoundView): boolean {
  return showSound(SECTIONS[view]);
}

export function sleepNow(now: number): SleepShown | null {
  const timer = useSleepTimerStore.getState().timer;
  if (!timer) return null;
  if (timer.kind === 'track') return 'track_end';
  return { minutes_left: Math.max(1, Math.ceil((timer.endsAt - now) / 60_000)) };
}

export function effectNow(): string | null {
  const { enabled, preset } = useEffectsStore.getState();
  if (!enabled || preset === 'off') return null;
  const named = Object.entries(PRESETS).find(([, id]) => id === preset);
  return named ? named[0] : 'custom';
}
