import { emit } from '@tauri-apps/api/event';
import { SPEECH } from '../../../lib/voice/levels';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import type { Model, VoiceCommand } from '../../../lib/voice/types';
import { KHOCHU_M, KHOCHU_Z, labDevices } from './fixtures';

const LEVEL_MS = 33;

let meter: ReturnType<typeof setInterval> | null = null;
let speech: ReturnType<typeof setInterval> | null = null;
let talking: string | null = null;
let phase = 0;
let demo = 0;
const downloads = new Map<string, ReturnType<typeof setInterval>>();

function speechRms(t: number): number {
  const syllable = Math.max(0, Math.sin(t * 9.3)) * Math.max(0, Math.sin(t * 2.1 + 1));
  return 0.02 + 0.22 * syllable + 0.04 * Math.random();
}

function emitLevels() {
  phase += LEVEL_MS / 1000;
  for (const input of labDevices().inputs) {
    const base = input.id === 'blackhole' ? 0 : 0.004 + Math.random() * 0.01;
    const rms =
      input.id === (talking ?? 'mac-mic')
        ? speechRms(phase)
        : input.id === 'airpods'
          ? speechRms(phase + 3) * 0.35
          : base;
    void emit('voice:level', { input: input.id, rms });
  }
}

export function setMeter(on: boolean) {
  if (on && !meter) meter = setInterval(emitLevels, LEVEL_MS);
  if (!on && meter) {
    clearInterval(meter);
    meter = null;
  }
}

let offline = false;

export function setOffline(on: boolean) {
  offline = on;
}

export function isOffline(): boolean {
  return offline;
}

export function startDownload(id: string) {
  if (downloads.has(id)) return;
  const timer = setInterval(() => {
    const model = useVoiceRuntime.getState().models.find((m: Model) => m.id === id);
    if (!model) return;
    const done = Math.min(model.total, model.done + model.total * 0.01 + 120_000);
    const finished = done >= model.total;
    void emit('voice:models', {
      id,
      state: finished ? 'ready' : 'downloading',
      done,
      total: model.total,
    });
    if (finished) {
      clearInterval(timer);
      downloads.delete(id);
    }
  }, 160);
  downloads.set(id, timer);
}

export function stopDownloads() {
  for (const timer of downloads.values()) clearInterval(timer);
  downloads.clear();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setSpeech(on: boolean) {
  if (on && !speech) {
    let t = 0;
    speech = setInterval(() => {
      t += LEVEL_MS / 1000;
      void emit('voice:level', { input: SPEECH, rms: speechRms(t) * 1.6 });
    }, LEVEL_MS);
  }
  if (!on && speech) {
    clearInterval(speech);
    speech = null;
  }
}

async function speak(source: string, ms: number) {
  void emit('voice:state', { state: 'speaking', source });
  setSpeech(true);
  await wait(ms);
  setSpeech(false);
  void emit('voice:state', { state: 'idle', source });
}

const DEMOS: { words: string[]; command: Omit<VoiceCommand, 'id' | 'source'>[] }[] = [
  {
    words: ['громкость', 'громкость пятьдесят'],
    command: [
      {
        heard: 'громкость пятьдесят',
        normalized: 'громкость 50',
        intent: 'volume_set',
        kind_hint: null,
        number: 50,
        decision: null,
      },
    ],
  },
  {
    words: ['выключи', 'выключи повтор', 'выключи повтор и перемешай'],
    command: [
      {
        heard: 'выключи повтор и перемешай',
        normalized: 'выключи повтор',
        intent: 'repeat_off',
        kind_hint: null,
        number: null,
        decision: null,
        step: 1,
        steps: 2,
      },
      {
        heard: 'выключи повтор и перемешай',
        normalized: 'перемешай',
        intent: 'shuffle_on',
        kind_hint: null,
        number: null,
        decision: null,
        step: 2,
        steps: 2,
      },
    ],
  },
  {
    words: ['включи', 'включи хочу'],
    command: [
      {
        heard: 'включи хочу',
        normalized: 'включи хочу',
        intent: 'play',
        kind_hint: null,
        number: null,
        decision: {
          decision: 'ask',
          first: { entity: KHOCHU_Z, score: 0.82 },
          second: { entity: KHOCHU_M, score: 0.8 },
        },
      },
    ],
  },
  {
    words: ['поставь', 'поставь абырвалг'],
    command: [
      {
        heard: 'поставь абырвалг',
        normalized: 'поставь абырвалг',
        intent: 'play',
        kind_hint: null,
        number: null,
        decision: { decision: 'not_found' },
      },
    ],
  },
];

export async function runDemo(source: string) {
  const script = DEMOS[demo % DEMOS.length];
  demo++;
  talking = 'mac-mic';
  void emit('voice:state', { state: 'listening', source, input: 'mac-mic' });
  const wasMetering = meter !== null;
  setMeter(true);
  for (const words of script.words) {
    await wait(650);
    void emit('voice:partial', { text: words });
  }
  await wait(600);
  if (!wasMetering) setMeter(false);
  void emit('voice:state', { state: 'thinking', source });
  await wait(500);
  const group = `g-${Date.now()}`;
  script.command.forEach((cmd, i) => {
    const multi = script.command.length > 1;
    void emit('voice:command', {
      ...cmd,
      id: `${group}-${i}`,
      source,
      group: multi ? group : undefined,
    });
  });
  if (script.command[0].decision?.decision === 'ask') {
    void emit('voice:state', { state: 'asking', source });
    return;
  }
  await wait(300);
  await speak(source, 1800);
}

export async function answerDemo(choice: string) {
  const entity = choice === 'second' ? KHOCHU_M : KHOCHU_Z;
  await wait(350);
  void emit('voice:command', {
    id: `ans-${Date.now()}`,
    source: 'button',
    heard: 'включи хочу',
    normalized: 'включи хочу',
    intent: 'play',
    kind_hint: 'track',
    number: null,
    decision: { decision: 'act', pick: { entity, score: 0.9 } },
  });
  await wait(300);
  await speak('button', 1600);
}

export async function previewDemo() {
  await wait(200);
  await speak('button', 2600);
}

export async function teachDemo() {
  talking = 'mac-mic';
  const wasMetering = meter !== null;
  setMeter(true);
  await wait(1400);
  if (!wasMetering) setMeter(false);
}
