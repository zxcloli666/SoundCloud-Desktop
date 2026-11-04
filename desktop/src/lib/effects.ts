import {
  type EffectsPresetId,
  type FxRestore,
  type FxSettings,
  useEffectsStore,
} from '../stores/effects';
import { clampPlaybackRate, usePlayerStore } from '../stores/player';
import { trackedInvoke as invoke } from './diagnostics';

interface Preset {
  rate?: number;
  fx: Partial<FxSettings>;
}

export const EFFECT_PRESETS: Record<'slowedReverb' | 'spedUp' | 'eightD' | 'bass', Preset> = {
  slowedReverb: { rate: 0.85, fx: { reverb: 0.45, room: 0.75, eightD: false, bassDb: 0 } },
  spedUp: { rate: 1.25, fx: { reverb: 0, eightD: false, bassDb: 0 } },
  eightD: { fx: { reverb: 0, eightD: true, eightDHz: 0.15, bassDb: 0 } },
  bass: { fx: { reverb: 0, eightD: false, bassDb: 8 } },
};

export const PRESET_ORDER = ['off', 'slowedReverb', 'spedUp', 'eightD', 'bass'] as const;

export const FX_RANGE = {
  reverb: { min: 0, max: 1, step: 0.01 },
  room: { min: 0, max: 1, step: 0.01 },
  eightDHz: { min: 0.05, max: 0.5, step: 0.01 },
  bassDb: { min: 0, max: 12, step: 0.5 },
} as const;

function liveRestore(): FxRestore {
  const { playbackRate, pitchControlMode, pitchSemitones } = usePlayerStore.getState();
  return { rate: playbackRate, pitchMode: pitchControlMode, pitch: pitchSemitones };
}

function applyRestore(restore: FxRestore) {
  usePlayerStore.setState({
    playbackRate: clampPlaybackRate(restore.rate),
    pitchControlMode: restore.pitchMode,
    pitchSemitones: restore.pitch,
  });
}

function applyPresetRate(rate: number) {
  usePlayerStore.setState({ playbackRate: clampPlaybackRate(rate), pitchControlMode: 'auto' });
}

export function selectPreset(id: EffectsPresetId) {
  const state = useEffectsStore.getState();
  if (id === 'off') {
    if (state.restore) applyRestore(state.restore);
    useEffectsStore.setState({ enabled: false, preset: 'off', restore: null });
    return;
  }
  if (id === 'custom') {
    useEffectsStore.setState({
      enabled: true,
      preset: 'custom',
      restore: state.restore ?? liveRestore(),
    });
    return;
  }
  const preset = EFFECT_PRESETS[id];
  const restore = state.restore ?? liveRestore();
  if (preset.rate !== undefined) applyPresetRate(preset.rate);
  else applyRestore(restore);
  useEffectsStore.setState({ ...preset.fx, enabled: true, preset: id, restore });
}

export function toggleEffects() {
  const state = useEffectsStore.getState();
  if (state.enabled) {
    if (state.restore) applyRestore(state.restore);
    useEffectsStore.setState({ enabled: false, restore: null });
    return;
  }
  selectPreset(state.preset === 'off' ? 'slowedReverb' : state.preset);
}

export function setManualFx(patch: Partial<FxSettings>) {
  const state = useEffectsStore.getState();
  useEffectsStore.setState({
    ...patch,
    enabled: true,
    preset: 'custom',
    restore: state.restore ?? liveRestore(),
  });
}

function pushToRust() {
  const { enabled, reverb, room, eightD, eightDHz, bassDb } = useEffectsStore.getState();
  const settings = enabled
    ? { reverb, room, eightD, eightDHz, bassDb }
    : { reverb: 0, room, eightD: false, eightDHz, bassDb: 0 };
  invoke('audio_set_effects', { settings }).catch(console.error);
}

let started = false;

export function initEffects() {
  if (started) return;
  started = true;
  const push = () => pushToRust();
  useEffectsStore.subscribe(push);
  if (useEffectsStore.persist.hasHydrated()) push();
  else useEffectsStore.persist.onFinishHydration(push);
}
