import { setIsPremium } from '../../../lib/premium-cache';
import { useChatLive } from '../../../lib/voice/chat/live';
import { enqueueCommand } from '../../../lib/voice/executor';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { useVoiceStore } from '../../../lib/voice/store';
import type { ErrorEvent, Model } from '../../../lib/voice/types';
import { setOffline, setSpeech, startDownload, stopDownloads } from './engine';
import {
  downloadingModels,
  firstRunModels,
  LAB_MARKS,
  labDevices,
  labHistory,
  labNotes,
  labWakeLog,
  readyModels,
} from './fixtures';

export const SCENES = [
  'ready',
  'first',
  'downloading',
  'errors',
  'missing',
  'free',
  'chat',
  'hud',
] as const;
export type Scene = (typeof SCENES)[number];

function base(models: Model[], error: ErrorEvent | null = null) {
  stopDownloads();
  setOffline(false);
  setSpeech(false);
  const devices = labDevices();
  useVoiceRuntime.setState({
    engine: 'idle',
    source: null,
    partial: '',
    hud: { kind: 'hidden' },
    availability: 'ready',
    models,
    devices,
    previewing: null,
    status: {
      state: 'idle',
      star: true,
      models: { ready: 0, total: models.length },
      devices,
      error,
    },
  });
}

function configure(enabled: boolean) {
  const store = useVoiceStore.getState();
  store.patch({ enabled, language: 'ru', echo: 'auto' });
  store.patchActivation({ headset: 'double', hold: true });
  store.patchWake({ on: true, sensitivity: 0.55 });
  store.patchListen({ mode: 'chosen', devices: ['mac-mic', 'airpods'] });
  store.patchSpeak({ voice: 'loli', mode: 'with_music', speed: 1.05, pitch: 1, replies: true });
}

function playVolume() {
  enqueueCommand({
    id: 'lab-volume',
    source: 'hotkey',
    heard: 'громкость пятьдесят',
    normalized: 'громкость 50',
    intent: 'volume_set',
    kind_hint: null,
    number: 50,
    decision: null,
  });
}

let asking: ReturnType<typeof setTimeout> | null = null;

function askLoli() {
  if (asking) clearTimeout(asking);
  asking = setTimeout(() => {
    enqueueCommand({
      id: `lab-chat-${Date.now()}`,
      source: 'hotkey',
      heard: 'включи что-нибудь под настроение',
      normalized: 'включи что-нибудь под настроение',
      intent: 'none',
      kind_hint: null,
      number: null,
      decision: null,
    });
  }, 300);
}

function showReply() {
  useChatLive.setState({
    parts: ['Включила «Хочу» Земфиры и убавила громкость, чтобы не пугать соседей.'],
    marks: LAB_MARKS,
  });
}

export function applyScene(scene: Scene) {
  const now = Date.now();
  setIsPremium(scene !== 'free');
  const store = useVoiceStore.getState();
  if (scene === 'first') {
    base(firstRunModels());
    configure(false);
    useVoiceStore.setState({ history: [], wakeLog: [], wakeTaught: false });
    store.patchActivation({ headset: 'off' });
    store.patchWake({ on: false });
    return;
  }
  if (scene === 'downloading') {
    base(downloadingModels());
    configure(true);
    useVoiceStore.setState({ history: [], wakeLog: [], wakeTaught: false });
    startDownload('asr-en');
    startDownload('tts-ru');
    return;
  }
  if (scene === 'errors') {
    base(
      readyModels().map((m) =>
        m.id === 'wake' ? { ...m, state: 'corrupted', done: Math.round(m.total * 0.9) } : m,
      ),
      {
        code: 'mic_denied',
      },
    );
    configure(true);
    store.patch({ echo: 'off' });
    useVoiceStore.setState({
      history: labHistory(now).slice(0, 3),
      wakeLog: labWakeLog(now),
      wakeTaught: false,
    });
    useVoiceRuntime.getState().setHud({ kind: 'error', code: 'mic_denied' });
    return;
  }
  if (scene === 'missing') {
    base([]);
    setOffline(true);
    useVoiceRuntime.setState({
      availability: 'missing',
      status: null,
      devices: { inputs: [], outputs: [] },
    });
    configure(true);
    useVoiceStore.setState({ history: [], wakeLog: [] });
    return;
  }
  base(readyModels());
  configure(true);
  useVoiceStore.setState({
    history: labHistory(now),
    notes: labNotes(),
    wakeLog: labWakeLog(now),
    wakeTaught: true,
  });
  if (scene === 'ready' || scene === 'hud') playVolume();
  if (scene === 'chat') askLoli();
  if (scene === 'hud') {
    setSpeech(true);
    showReply();
  }
}
