import { voiceIpc } from './ipc';
import { useVoiceRuntime } from './runtime';
import type { Model } from './types';

function needs(model: Model): boolean {
  return model.state !== 'ready' && model.state !== 'downloading';
}

export function downloadModel(id: string) {
  const runtime = useVoiceRuntime.getState();
  const model = runtime.models.find((m) => m.id === id);
  if (model)
    runtime.mergeProgress({
      id,
      state: 'downloading',
      done: model.state === 'corrupted' ? 0 : model.done,
      total: model.total || model.size,
    });
  voiceIpc.modelGet(id).catch(() => {
    if (model)
      useVoiceRuntime
        .getState()
        .mergeProgress({ id, state: model.state, done: model.done, total: model.total });
  });
}

export function downloadMissing() {
  for (const model of useVoiceRuntime.getState().models) {
    if (!model.optional && needs(model)) downloadModel(model.id);
  }
}

export function deleteModel(id: string) {
  const runtime = useVoiceRuntime.getState();
  const model = runtime.models.find((m) => m.id === id);
  runtime.mergeProgress({ id, state: 'missing', done: 0, total: model?.total ?? 0 });
  voiceIpc.modelDelete(id).catch(() => {
    if (model)
      useVoiceRuntime
        .getState()
        .mergeProgress({ id, state: model.state, done: model.done, total: model.total });
  });
}
