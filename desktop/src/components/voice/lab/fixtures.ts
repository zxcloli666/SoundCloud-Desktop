import type { RemoteLink } from '../../../lib/voice/remote-types';
import type { HistoryRow, WakeMark } from '../../../lib/voice/store';
import type { Devices, Entity, Model } from '../../../lib/voice/types';

const MB = 1024 * 1024;

const LICENSES: Record<string, string> = {
  vad: 'MIT',
  'asr-ru': 'Apache-2.0',
  'asr-en': 'MIT',
  'tts-ru': 'own',
  'tts-en': 'Apache-2.0',
  wake: 'own',
  llm: 'Apache-2.0',
};

export function labDevices(): Devices {
  return {
    inputs: [
      { id: 'mac-mic', name: 'MacBook Pro Microphone', transport: 'builtin', default: true },
      { id: 'airpods', name: 'AirPods Pro', transport: 'bluetooth', default: false },
      { id: 'yeti', name: 'Blue Yeti', transport: 'usb', default: false },
      { id: 'blackhole', name: 'BlackHole 2ch', transport: 'virtual', default: false },
    ],
    outputs: [
      { id: 'mac-out', name: 'MacBook Pro Speakers', transport: 'builtin', default: true },
      { id: 'airpods-out', name: 'AirPods Pro', transport: 'bluetooth', default: false },
      { id: 'display', name: 'Studio Display', transport: 'hdmi', default: false },
    ],
  };
}

function model(
  id: string,
  kind: string,
  language: string,
  size: number,
  state: Model['state'],
  done = 0,
  optional = false,
): Model {
  const total = Math.round(size * MB);
  return {
    id,
    kind,
    language,
    size: total,
    state,
    done: state === 'ready' ? total : Math.round(done * total),
    total,
    license: LICENSES[id] ?? 'Apache-2.0',
    optional,
  };
}

export function readyModels(): Model[] {
  return [
    model('vad', 'vad', 'any', 0.6, 'ready'),
    model('asr-ru', 'asr', 'ru', 68, 'ready'),
    model('asr-en', 'asr', 'en', 61, 'ready'),
    model('tts-ru', 'tts', 'ru', 84, 'ready'),
    model('tts-en', 'tts', 'en', 92, 'ready'),
    model('wake', 'wake', 'ru', 3.2, 'ready'),
    model('llm', 'llm', 'any', 412, 'missing', 0, true),
  ];
}

export function firstRunModels(): Model[] {
  return [
    model('vad', 'vad', 'any', 0.6, 'ready'),
    model('asr-ru', 'asr', 'ru', 68, 'missing'),
    model('asr-en', 'asr', 'en', 61, 'missing'),
    model('tts-ru', 'tts', 'ru', 84, 'partial', 0.31),
    model('tts-en', 'tts', 'en', 92, 'missing'),
    model('wake', 'wake', 'ru', 3.2, 'missing'),
    model('llm', 'llm', 'any', 412, 'missing', 0, true),
  ];
}

export function downloadingModels(): Model[] {
  return [
    model('vad', 'vad', 'any', 0.6, 'ready'),
    model('asr-ru', 'asr', 'ru', 68, 'ready'),
    model('asr-en', 'asr', 'en', 61, 'downloading', 0.64),
    model('tts-ru', 'tts', 'ru', 84, 'downloading', 0.22),
    model('tts-en', 'tts', 'en', 92, 'missing'),
    model('wake', 'wake', 'ru', 3.2, 'corrupted', 0.9),
    model('llm', 'llm', 'any', 412, 'missing', 0, true),
  ];
}

export const SCRIPTONITE: Entity = {
  kind: 'artist',
  name: 'Скриптонит',
  artist: '',
  popularity: 6_500_000,
  id: 'art-1',
};
export const KHOCHU_Z: Entity = {
  kind: 'track',
  name: 'Хочу',
  artist: 'Земфира',
  popularity: 900_000,
  id: '1001',
};
export const KHOCHU_M: Entity = {
  kind: 'track',
  name: 'Хочу',
  artist: 'Мот',
  popularity: 700_000,
  id: '1002',
};

export function labHistory(now: number): HistoryRow[] {
  const at = (min: number) => now - min * 60_000;
  return [
    {
      id: 'h1',
      at: at(3),
      source: 'hotkey',
      heard: 'включи скриптонита',
      intents: ['play'],
      label: 'Скриптонит',
      result: 'done',
      undoable: false,
      wrong: false,
    },
    {
      id: 'h2',
      at: at(11),
      source: 'headset',
      heard: 'выключи повтор и перемешай',
      intents: ['repeat_off', 'shuffle_on'],
      label: 'Повтор выкл, Перемешано',
      result: 'done',
      undoable: false,
      wrong: false,
    },
    {
      id: 'h3',
      at: at(26),
      source: 'wake',
      heard: 'включи хочу',
      intents: ['play'],
      label: 'Земфира или Мот?',
      result: 'asked',
      undoable: false,
      wrong: false,
    },
    {
      id: 'h4',
      at: at(42),
      source: 'remote',
      heard: 'лайк',
      intents: ['like'],
      label: 'Лайк',
      result: 'done',
      undoable: false,
      wrong: false,
    },
    {
      id: 'h5',
      at: at(64),
      source: 'button',
      heard: 'включи кино',
      intents: ['play'],
      label: 'Кинопробы — Сплин',
      result: 'done',
      undoable: false,
      wrong: true,
    },
    {
      id: 'h6',
      at: at(95),
      source: 'typed',
      heard: 'поставь абырвалг',
      intents: ['play'],
      label: 'абырвалг',
      result: 'not_found',
      undoable: false,
      wrong: false,
    },
    {
      id: 'h7',
      at: at(130),
      source: 'hotkey',
      heard: 'потише',
      intents: ['volume_down'],
      label: 'Громкость 40',
      result: 'done',
      undoable: false,
      wrong: false,
    },
    {
      id: 'h8',
      at: at(180),
      source: 'wake',
      heard: 'что сейчас играет',
      intents: ['now_playing'],
      label: 'Скриптонит — Притон',
      result: 'done',
      undoable: false,
      wrong: false,
    },
  ];
}

export function labWakeLog(now: number): WakeMark[] {
  const hours = [1, 2, 2, 4, 5, 7, 9, 13, 15, 18, 21];
  return hours.map((h, i) => ({ at: now - h * 3_600_000 - i * 60_000, ok: i !== 3 && i !== 8 }));
}

export function labLinks(now: number): RemoteLink[] {
  return [
    {
      id: 'link-1',
      provider: 'alice',
      created_at: new Date(now - 6 * 86_400_000).toISOString(),
      last_used_at: new Date(now - 5 * 60_000).toISOString(),
    },
  ];
}
