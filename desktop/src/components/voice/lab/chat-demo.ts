import { emit } from '@tauri-apps/api/event';
import type { ChatEvent, ChatRequest } from '../../../lib/voice/chat/types';
import type { Entity, EntityKind } from '../../../lib/voice/types';
import { setSpeech } from './engine';
import { KHOCHU_M, KHOCHU_Z, SCRIPTONITE } from './fixtures';

const THINK_MS = 900;
const WORD_MS = 70;
const ACTION_MS = 260;
const SPEECH_TAIL_MS = 1400;

const DONE: ChatEvent = { kind: 'done' };

interface Script {
  match: RegExp;
  reject?: string;
  rounds: ChatEvent[][];
}

const SCRIPTS: Script[] = [
  { match: /лимит|limit/i, reject: 'rate_limited', rounds: [] },
  { match: /сервер|server/i, reject: 'unavailable', rounds: [] },
  { match: /связь|connection/i, reject: 'network', rounds: [] },
  {
    match: /ошибк|error/i,
    rounds: [
      [
        { kind: 'say', text: 'Секунду, сейчас посмотрю' },
        { kind: 'error', code: 'provider_failed' },
      ],
    ],
  },
  {
    match: /запомни|remember/i,
    rounds: [
      [
        { kind: 'action', name: 'remember', args: { note: 'По утрам любит пост-панк' } },
        { kind: 'say', text: 'Запомнила. По утрам только пост-панк, никакой попсы.' },
        DONE,
      ],
    ],
  },
  {
    match: /тем|theme/i,
    rounds: [
      [
        { kind: 'say', text: 'Включаю светлую тему. Если ослепит, скажи, верну как было.' },
        { kind: 'action', name: 'set_setting', args: { key: 'theme', value: 'white' } },
        DONE,
      ],
    ],
  },
  {
    match: /расскажи|tell/i,
    rounds: [
      [
        {
          kind: 'say',
          text: 'Это песня о том, как хочется всего и сразу. Земфира записала её в двухтысячном, и с тех пор её ставят, когда слова закончились, а чувства остались. В припеве голос срывается почти на крик, а потом всё стихает до шёпота. Если понравилось, могу поставить похожее или собрать очередь из той же эпохи.',
        },
        DONE,
      ],
    ],
  },
  {
    match: /умеешь|помощь|help/i,
    rounds: [
      [
        {
          kind: 'say',
          text: 'Включу музыку по названию, поставлю на паузу, сделаю громче, открою нужную страницу, поменяю настройки и запомню, что ты любишь. Просто скажи.',
        },
        DONE,
      ],
    ],
  },
  {
    match: /./,
    rounds: [
      [
        { kind: 'say', text: 'Сейчас найду.' },
        { kind: 'action', name: 'play', args: { query: 'хочу', kind: 'track' } },
        DONE,
      ],
      [
        {
          kind: 'say',
          text: 'Включила «Хочу» Земфиры и убавила громкость, чтобы не пугать соседей.',
        },
        { kind: 'action', name: 'volume', args: { mode: 'set', value: 40 } },
        { kind: 'action', name: 'like', args: { on: true } },
        DONE,
      ],
    ],
  },
];

const typed = new Map<string, string>();
let streaming: string | null = null;
let stopped = false;
let quiet: ReturnType<typeof setTimeout> | null = null;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function voice(on: boolean) {
  if (quiet) clearTimeout(quiet);
  quiet = null;
  setSpeech(on);
  void emit('voice:state', { state: on ? 'speaking' : 'idle', source: 'button' });
}

function settle(ms: number) {
  if (quiet) clearTimeout(quiet);
  quiet = setTimeout(() => voice(false), ms);
}

async function stream(turn: ChatRequest, events: ChatEvent[], send: (event: ChatEvent) => void) {
  await wait(THINK_MS);
  for (const event of events) {
    const words = event.kind === 'say' ? (event.text.match(/\S+\s*/g) ?? []) : [];
    if (words.length > 0 && turn.speak && !stopped) voice(true);
    for (const text of words) {
      if (stopped) break;
      send({ kind: 'say', text });
      await wait(WORD_MS);
    }
    if (stopped) return send({ kind: 'cancelled' });
    if (event.kind !== 'say') send(event);
    await wait(ACTION_MS);
  }
}

export async function chatDemo(turn: ChatRequest, send: (event: ChatEvent) => void) {
  const script = SCRIPTS.find((s) => s.match.test(turn.body.text)) ?? SCRIPTS[SCRIPTS.length - 1];
  await wait(200);
  if (script.reject) return Promise.reject({ code: script.reject });
  streaming = turn.id;
  stopped = false;
  const round = turn.body.results.length > 0 ? script.rounds.length - 1 : 0;
  await stream(turn, script.rounds[round], send);
  streaming = null;
  settle(turn.speak && !stopped ? SPEECH_TAIL_MS : 0);
}

export function cancelChatDemo(id: string) {
  if (streaming === id) stopped = true;
}

export function resolveDemo(kinds: EntityKind[]): Entity[] {
  return [KHOCHU_Z, KHOCHU_M, SCRIPTONITE].filter((e) => kinds.includes(e.kind));
}

function heard(id: string, text: string, chatless: boolean) {
  return {
    id,
    source: 'typed',
    heard: text,
    normalized: text,
    intent: 'none',
    kind_hint: null,
    number: null,
    decision: null,
    chatless,
  };
}

export async function textDemo(text: string, id = `typed-${Date.now()}`) {
  await wait(250);
  typed.set(id, text);
  await emit('voice:state', { state: 'thinking', source: 'typed' });
  void emit('voice:command', heard(id, text, false));
}

export async function rereadDemo(id: string) {
  const text = typed.get(id);
  if (text === undefined) {
    settle(0);
    throw new Error('nobody waits for this phrase');
  }
  typed.delete(id);
  void emit('voice:command', heard(`again-${Date.now()}`, text, true));
  settle(SPEECH_TAIL_MS);
}
