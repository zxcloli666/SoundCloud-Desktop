import { create } from 'zustand';
import type {
  Devices,
  EngineState,
  Entity,
  Intent,
  Model,
  ModelProgress,
  Scored,
  Status,
  VoiceErrorCode,
  VoiceSource,
} from './types';

export interface DoneItem {
  intent: Intent;
  entity: Entity | null;
  display: string;
}

export type HudView =
  | { kind: 'hidden' }
  | { kind: 'listening'; source: VoiceSource }
  | { kind: 'thinking' }
  | { kind: 'done'; id: string; heard: string; items: DoneItem[]; undo: boolean; at: number }
  | { kind: 'asking'; id: string; heard: string; first: Scored; second: Scored }
  | { kind: 'not_found'; heard: string }
  | { kind: 'failed'; display: string }
  | { kind: 'error'; code: VoiceErrorCode }
  | { kind: 'speaking' };

export type Availability = 'unknown' | 'ready' | 'missing';
export type RemoteLoop = 'off' | 'live' | 'retrying';

interface VoiceRuntime {
  engine: EngineState;
  source: VoiceSource | null;
  partial: string;
  hud: HudView;
  availability: Availability;
  status: Status | null;
  models: Model[];
  devices: Devices;
  headsetAt: number;
  previewing: string | null;
  remote: RemoteLoop;
  settingsOpen: boolean;
  setHud: (hud: HudView) => void;
  hideHud: () => void;
  setModels: (models: Model[]) => void;
  mergeProgress: (p: ModelProgress) => void;
}

const NO_DEVICES: Devices = { inputs: [], outputs: [] };

export const useVoiceRuntime = create<VoiceRuntime>((set) => ({
  engine: 'idle',
  source: null,
  partial: '',
  hud: { kind: 'hidden' },
  availability: 'unknown',
  status: null,
  models: [],
  devices: NO_DEVICES,
  headsetAt: 0,
  previewing: null,
  remote: 'off',
  settingsOpen: false,
  setHud: (hud) => set({ hud }),
  hideHud: () => set({ hud: { kind: 'hidden' } }),
  setModels: (models) => set({ models }),
  mergeProgress: (p) =>
    set((s) => ({
      models: s.models.map((m) =>
        m.id === p.id ? { ...m, state: p.state, done: p.done, total: p.total || m.total } : m,
      ),
    })),
}));

export interface ModelSummary {
  required: number;
  ready: number;
  downloading: boolean;
  done: number;
  total: number;
  missingBytes: number;
  broken: boolean;
}

export function summarize(models: Model[]): ModelSummary {
  const required = models.filter((m) => !m.optional);
  const ready = required.filter((m) => m.state === 'ready').length;
  const active = models.filter((m) => m.state === 'downloading' || m.state === 'partial');
  const downloading = models.some((m) => m.state === 'downloading');
  const done = active.reduce((n, m) => n + m.done, 0);
  const total = active.reduce((n, m) => n + (m.total || m.size), 0);
  const missingBytes = required
    .filter((m) => m.state !== 'ready')
    .reduce(
      (n, m) => n + Math.max(0, (m.total || m.size) - (m.state === 'corrupted' ? 0 : m.done)),
      0,
    );
  const broken = models.some((m) => m.state === 'corrupted');
  return { required: required.length, ready, downloading, done, total, missingBytes, broken };
}

export function modelsReady(models: Model[]): boolean {
  const s = summarize(models);
  return s.required > 0 && s.ready === s.required;
}
