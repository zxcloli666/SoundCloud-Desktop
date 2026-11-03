import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createThrottledJsonStorage } from '../lib/tauri-storage';
import { FX_DEFAULT, type FxState } from './effects';
import type { PitchControlMode } from './player';

export interface TrackSound {
  rate: number;
  pitch: number;
  pitchMode: PitchControlMode;
  eqEnabled: boolean;
  eqGains: number[];
  eqPreset: string;
  eqPreamp: number | null;
  fx: FxState;
}

export interface TrackSoundOverride extends TrackSound {
  usedAt: number;
}

interface TrackSoundState {
  overrides: Record<string, TrackSoundOverride>;
  active: { urn: string; baseline: TrackSound } | null;
}

export const useTrackSoundStore = create<TrackSoundState>()(
  persist(
    (): TrackSoundState => ({
      overrides: {},
      active: null,
    }),
    {
      name: 'sc-track-sound',
      storage: createThrottledJsonStorage(),
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as TrackSoundState;
        if (version >= 2) return state;
        const overrides = Object.fromEntries(
          Object.entries(state.overrides ?? {}).map(([urn, sound]) => [
            urn,
            { ...sound, fx: FX_DEFAULT },
          ]),
        );
        const active = state.active
          ? { ...state.active, baseline: { ...state.active.baseline, fx: FX_DEFAULT } }
          : null;
        return { overrides, active };
      },
    },
  ),
);
