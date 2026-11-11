import { loadVoiceLocales } from '../../i18n';
import { voiceIpc } from './ipc';
import { engineConfig } from './names';
import { useVoiceRuntime } from './runtime';
import { useVoiceStore } from './store';

const APPLY_DEBOUNCE_MS = 120;

function push() {
  loadVoiceLocales()
    .then((locales) => voiceIpc.apply(engineConfig(useVoiceStore.getState().config, locales)))
    .then(() => useVoiceRuntime.setState({ availability: 'ready' }))
    .catch(() => useVoiceRuntime.setState({ availability: 'missing' }));
}

export function refreshEngine() {
  voiceIpc
    .status()
    .then((status) =>
      useVoiceRuntime.setState({ status, devices: status.devices, availability: 'ready' }),
    )
    .catch(() => useVoiceRuntime.setState({ availability: 'missing' }));
  voiceIpc
    .models()
    .then((models) => useVoiceRuntime.getState().setModels(models))
    .catch(() => {});
}

export function startConfigSync() {
  if (useVoiceStore.persist.hasHydrated()) push();
  else useVoiceStore.persist.onFinishHydration(push);
  let timer: ReturnType<typeof setTimeout> | null = null;
  useVoiceStore.subscribe((state, prev) => {
    if (state.config === prev.config) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, APPLY_DEBOUNCE_MS);
  });
}
