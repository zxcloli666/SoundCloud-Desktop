import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../tauri-storage';
import type { ToolMark } from './chat/types';
import { defaultConfig } from './defaults';
import { mergeConfig, SAVED_VERSION, upgradeSaved } from './saved';
import type {
  ActivationConfig,
  Intent,
  ListenConfig,
  ListenerConfig,
  RelationConfig,
  SpeakConfig,
  VoiceConfig,
  VoiceSource,
  WakeConfig,
} from './types';

const HISTORY_CAP = 60;
const WAKE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type RowResult = 'done' | 'asked' | 'not_found' | 'failed' | 'ignored' | 'replied';

export interface RowReply {
  voice: string;
  text: string;
  marks: ToolMark[];
  failed?: string;
}

export interface HistoryRow {
  id: string;
  at: number;
  source: VoiceSource;
  heard: string;
  intents: Intent[];
  label: string;
  result: RowResult;
  undoable: boolean;
  wrong: boolean;
  reply?: RowReply;
}

export interface WakeMark {
  at: number;
  ok: boolean;
}

interface VoiceStore {
  config: VoiceConfig;
  history: HistoryRow[];
  notes: string[];
  wakeLog: WakeMark[];
  patch: (patch: Partial<VoiceConfig>) => void;
  patchActivation: (patch: Partial<ActivationConfig>) => void;
  patchWake: (patch: Partial<WakeConfig>) => void;
  patchListen: (patch: Partial<ListenConfig>) => void;
  patchSpeak: (patch: Partial<SpeakConfig>) => void;
  patchListener: (patch: Partial<ListenerConfig>) => void;
  patchRelation: (patch: Partial<RelationConfig>) => void;
  addRow: (row: HistoryRow) => void;
  toggleWrong: (id: string) => void;
  clearHistory: () => void;
  setNotes: (notes: string[]) => void;
  markWake: (mark: WakeMark) => void;
}

export const useVoiceStore = create<VoiceStore>()(
  persist(
    (set) => ({
      config: defaultConfig(),
      history: [],
      notes: [],
      wakeLog: [],
      patch: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      patchActivation: (patch) =>
        set((s) => ({ config: { ...s.config, activation: { ...s.config.activation, ...patch } } })),
      patchWake: (patch) =>
        set((s) => {
          const activation = s.config.activation;
          return {
            config: {
              ...s.config,
              activation: { ...activation, wake: { ...activation.wake, ...patch } },
            },
          };
        }),
      patchListen: (patch) =>
        set((s) => ({ config: { ...s.config, listen: { ...s.config.listen, ...patch } } })),
      patchSpeak: (patch) =>
        set((s) => ({ config: { ...s.config, speak: { ...s.config.speak, ...patch } } })),
      patchListener: (patch) =>
        set((s) => ({ config: { ...s.config, listener: { ...s.config.listener, ...patch } } })),
      patchRelation: (patch) =>
        set((s) => ({ config: { ...s.config, relation: { ...s.config.relation, ...patch } } })),
      addRow: (row) =>
        set((s) => ({
          history: [row, ...s.history.filter((r) => r.id !== row.id)].slice(0, HISTORY_CAP),
        })),
      toggleWrong: (id) =>
        set((s) => ({
          history: s.history.map((r) => (r.id === id ? { ...r, wrong: !r.wrong } : r)),
        })),
      clearHistory: () => set({ history: [] }),
      setNotes: (notes) => set({ notes }),
      markWake: (mark) =>
        set((s) => ({
          wakeLog: [...s.wakeLog.filter((m) => mark.at - m.at < WAKE_WINDOW_MS), mark],
        })),
    }),
    {
      name: 'sc-voice',
      version: SAVED_VERSION,
      storage: createJSONStorage(() => tauriStorage),
      migrate: (persisted, version) =>
        upgradeSaved((persisted ?? {}) as Partial<VoiceStore>, version),
      partialize: (s) => ({
        config: s.config,
        history: s.history,
        notes: s.notes,
        wakeLog: s.wakeLog,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<VoiceStore>;
        return {
          ...current,
          ...saved,
          config: mergeConfig(defaultConfig(), saved.config ?? current.config),
        };
      },
    },
  ),
);

export function falseWakesToday(log: WakeMark[], now: number): number {
  return log.filter((m) => !m.ok && now - m.at < WAKE_WINDOW_MS).length;
}
