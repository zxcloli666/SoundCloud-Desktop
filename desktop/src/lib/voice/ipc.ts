import { trackedInvoke as invoke } from '../diagnostics';
import type { Devices, EngineConfig, Model, Outcome, StartSource, Status } from './types';

export const voiceIpc = {
  status: () => invoke<Status>('voice_status'),
  apply: (config: EngineConfig) => invoke<void>('voice_apply', { config }),
  start: (source: StartSource) => invoke<void>('voice_start', { source }),
  stop: () => invoke<void>('voice_stop'),
  cancel: () => invoke<void>('voice_cancel'),
  text: (text: string, source: 'typed' | 'remote', id?: string) =>
    invoke<void>('voice_text', { text, source, id }),
  answer: (choice: string) => invoke<void>('voice_answer', { choice }),
  done: (id: string, outcome: Outcome) => invoke<void>('voice_done', { id, outcome }),
  reread: (id: string) => invoke<void>('voice_reread', { id }),
  devices: () => invoke<Devices>('voice_devices'),
  meter: (on: boolean) => invoke<void>('voice_meter', { on }),
  models: () => invoke<Model[]>('voice_models'),
  modelGet: (id: string) => invoke<void>('voice_model_get', { id }),
  modelDelete: (id: string) => invoke<void>('voice_model_delete', { id }),
  preview: (voiceId: string) => invoke<void>('voice_preview', { voiceId }),
};
