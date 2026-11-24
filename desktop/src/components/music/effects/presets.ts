import { EFFECT_PRESETS } from '../../../lib/effects';
import type { EffectsPresetId } from '../../../stores/effects';
import type { Scene } from './scene';

export const EFFECT_CARDS: EffectsPresetId[] = [
  'off',
  'slowedReverb',
  'spedUp',
  'eightD',
  'bass',
  'custom',
];

export const QUIET: Scene = {
  reverb: 0,
  room: 0.5,
  eightD: false,
  eightDHz: 0.15,
  bassDb: 0,
  rate: 1,
};

export const TEASER: Scene = { ...QUIET, reverb: 0.5, room: 0.7, eightD: true, bassDb: 7 };

export function presetScene(id: EffectsPresetId): Scene {
  if (id === 'off' || id === 'custom') return QUIET;
  const preset = EFFECT_PRESETS[id];
  return { ...QUIET, ...preset.fx, rate: preset.rate ?? 1 };
}
