import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../tauri-storage';
import type { ToolMark } from './chat/types';
import { defaultConfig } from './defaults';
import type {
  ActivationConfig,
  Intent,
  ListenConfig,
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
  wakeTaught: boolean;
  patch: (patch: Partial<VoiceConfig>) => void;
  patchActivation: (patch: Partial<ActivationConfig>) => void;
  patchWake: (patch: Partial<WakeConfig>) => void;
  patchListen: (patch: Partial<ListenConfig>) => void;
  patchSpeak: (patch: Partial<SpeakConfig>) => void;
  addRow: (row: HistoryRow) => void;
  toggleWrong: (id: string) => void;
  clearHistory: () => void;
  setNotes: (notes: string[]) => void;
  markWake: (mark: WakeMark) => void;
  setWakeTaught: (taught: boolean) => void;
}

export const useVoiceStore = create<VoiceStore>()(
  persist(
    (set) => ({
      config: defaultConfig(),
      history: [],
      notes: [],
      wakeLog: [],
      wakeTaught: false,
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
      setWakeTaught: (wakeTaught) => set({ wakeTaught }),
    }),
    {
      name: 'sc-voice',
      version: 2,
      storage: createJSONStorage(() => tauriStorage),
      migrate: (persisted, version) => {
        const saved = (persisted ?? {}) as Partial<VoiceStore>;
        if (version >= 2 || !saved.config) return saved;
        return { ...saved, config: { ...saved.config, llm: true } };
      },
      partialize: (s) => ({
        config: s.config,
        history: s.history,
        notes: s.notes,
        wakeLog: s.wakeLog,
        wakeTaught: s.wakeTaught,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<VoiceStore>;
        const base = defaultConfig();
        const config = saved.config ?? current.config;
        return {
          ...current,
          ...saved,
          config: {
            ...base,
            ...config,
            activation: {
              ...base.activation,
              ...config.activation,
              wake: { ...base.activation.wake, ...config.activation?.wake },
            },
            listen: { ...base.listen, ...config.listen },
            speak: { ...base.speak, ...config.speak },
            boosts: { ...base.boosts, ...config.boosts },
          },
        };
      },
    },
  ),
);

export function falseWakesToday(log: WakeMark[], now: number): number {
  return log.filter((m) => !m.ok && now - m.at < WAKE_WINDOW_MS).length;
}
