import { getIsPremium } from '../premium-cache';
import { voiceIpc } from './ipc';
import { modelsReady, useVoiceRuntime } from './runtime';
import { useVoiceStore } from './store';
import type { StartSource } from './types';

export function toggleListening(source: StartSource) {
  const runtime = useVoiceRuntime.getState();
  if (runtime.engine === 'listening') {
    void voiceIpc.stop().catch(() => {});
    return;
  }
  if (!getIsPremium()) {
    runtime.setHud({ kind: 'error', code: 'not_star' });
    return;
  }
  if (runtime.models.length > 0 && !modelsReady(runtime.models)) {
    runtime.setHud({ kind: 'error', code: 'no_models' });
    return;
  }
  if (!useVoiceStore.getState().config.enabled) useVoiceStore.getState().patch({ enabled: true });
  voiceIpc.start(source).catch(() => runtime.setHud({ kind: 'error', code: 'engine_missing' }));
}
