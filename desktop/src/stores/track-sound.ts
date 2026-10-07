import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createThrottledJsonStorage } from '../lib/tauri-storage';
import type { PitchControlMode } from './player';

export interface TrackSound {
  rate: number;
  pitch: number;
  pitchMode: PitchControlMode;
  eqEnabled: boolean;
  eqGains: number[];
  eqPreset: string;
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
      version: 1,
    },
  ),
);
