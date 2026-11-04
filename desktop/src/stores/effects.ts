import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createThrottledJsonStorage } from '../lib/tauri-storage';
import type { PitchControlMode } from './player';

export type EffectsPresetId = 'off' | 'slowedReverb' | 'spedUp' | 'eightD' | 'bass' | 'custom';

export interface FxRestore {
  rate: number;
  pitchMode: PitchControlMode;
  pitch: number;
}

export interface FxSettings {
  reverb: number;
  room: number;
  eightD: boolean;
  eightDHz: number;
  bassDb: number;
}

export interface FxState extends FxSettings {
  enabled: boolean;
  preset: EffectsPresetId;
  restore: FxRestore | null;
}

export const FX_DEFAULT: FxState = {
  enabled: false,
  preset: 'off',
  restore: null,
  reverb: 0,
  room: 0.5,
  eightD: false,
  eightDHz: 0.15,
  bassDb: 0,
};

export const useEffectsStore = create<FxState>()(
  persist((): FxState => FX_DEFAULT, {
    name: 'sc-effects',
    storage: createThrottledJsonStorage(),
    version: 1,
  }),
);

export function pickFx(state: FxState): FxState {
  const { enabled, preset, restore, reverb, room, eightD, eightDHz, bassDb } = state;
  return {
    enabled,
    preset,
    restore: restore ? { ...restore } : null,
    reverb,
    room,
    eightD,
    eightDHz,
    bassDb,
  };
}
