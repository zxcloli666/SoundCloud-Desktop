import type { Brief } from '../src/lib/voice/chat/context';
import { dropNote } from '../src/lib/voice/chat/notes.ts';
import type { AppPort } from '../src/lib/voice/chat/ports';
import type { SettingKey, SettingValue } from '../src/lib/voice/chat/settings';
import type {
  ChatBody,
  ChatEvent,
  ChatRequest,
  Ran,
  ToolEnv,
  ToolMark,
} from '../src/lib/voice/chat/types';
import type { Entity } from '../src/lib/voice/types';
import { command } from './voice-fake-port.ts';

export const TRACK: Entity = {
  kind: 'track',
  name: 'Положение',
  artist: 'Скриптонит',
  popularity: 9,
  id: 't7',
};

export interface FakeApp extends AppPort {
  calls: string[];
  notes: string[];
  values: Record<SettingKey, SettingValue>;
  found: Entity[];
  queue: Brief[];
}

export function fakeApp(): FakeApp {
  const calls: string[] = [];
  const app: FakeApp = {
    calls,
    notes: [],
    found: [],
    queue: [{ title: 'Track 2', artist: 'Скриптонит' }],
    values: {
      theme: 'dark',
      performance: 'beauty',
      equalizer: false,
      equalizer_preset: 'flat',
      normalize_volume: true,
      skip_silence: false,
      crossfade: 0,
      stream_quality: 'auto',
      autoplay: true,
      wave_mode: 'similar',
      wave_hide_liked: false,
      wave_hide_listened: true,
      lyrics_highlight: 'word',
      lyrics_visualizer: false,
      floating_comments: true,
      spoken_replies: true,
      voice_speed: 1,
    },
    resolve: async (query, kinds) => {
      calls.push(`resolve:${query}:${kinds.join('+')}`);
      return app.found.filter((e) => kinds.includes(e.kind));
    },
    open: (page, query, section) => {
      calls.push(`open:${page}:${query}:${section ?? ''}`);
      return page === 'current_album' ? 'no_page' : 'ok';
    },
    setSpeed: (rate) => {
      const clamped = Math.min(2, Math.max(0.5, rate));
      calls.push(`speed:${clamped}`);
      return clamped;
    },
    showLyrics: (open) => {
      calls.push(`lyrics:${open}`);
    },
    upNext: (limit) => app.queue.slice(0, limit),
    clearQueue: () => {
      calls.push('queue_clear');
      app.queue = [];
    },
    pickPlaylist: () => {
      calls.push('pick_playlist');
      return true;
    },
    settings: () => app.values,
    applySetting: (key, value) => {
      calls.push(`set:${key}:${value}`);
      app.values[key] = value;
    },
    remember: (note) => {
      if (!note.trim()) return false;
      app.notes.push(note);
      return true;
    },
    forget: (note) => {
      const res = dropNote(app.notes, note);
      app.notes = res.notes;
      return res.state;
    },
  };
  return app;
}

export function toolEnv(extra: Partial<ToolEnv> = {}): ToolEnv {
  return {
    cmd: command('none', { id: 'turn-1' }),
    lang: 'ru',
    now: 1000,
    stack: [],
    undo: false,
    ...extra,
  };
}

export type Step = ChatEvent | { wait: Promise<unknown> } | { reject: { code: string } };

export interface Wire {
  requests: ChatRequest[];
  send(request: ChatRequest, onEvent: (event: ChatEvent) => void): Promise<void>;
}

export function wire(rounds: Step[][]): Wire {
  const requests: ChatRequest[] = [];
  return {
    requests,
    send: async (request, onEvent) => {
      const script = rounds[requests.length] ?? [];
      requests.push(request);
      for (const step of script) {
        if ('reject' in step) throw step.reject;
        if ('wait' in step) await step.wait;
        else onEvent(step);
        await new Promise((next) => setImmediate(next));
      }
    },
  };
}

export function bodyOf(results: ChatBody['results']): ChatBody {
  return {
    text: 'привет',
    persona: 'loli',
    language: 'ru',
    context: {},
    history: [],
    notes: [],
    tools: [],
    results,
  };
}

export function ranOf(name: string, returns: boolean, result: Ran['result'] = { ok: true }): Ran {
  const mark: ToolMark = { tool: name, ok: result.ok };
  return { name, args: {}, result, returns, mark };
}
