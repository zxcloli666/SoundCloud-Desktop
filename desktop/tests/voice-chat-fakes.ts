import {
  arrange,
  defaultPlacement,
  type Placed,
  placementMap,
  type Surface,
} from '../src/lib/player-zones.ts';
import type { Brief } from '../src/lib/voice/chat/context';
import { addNote, dropNote } from '../src/lib/voice/chat/notes.ts';
import type { AppPort, ButtonPlace } from '../src/lib/voice/chat/ports';
import type { SettingKey, SettingValue } from '../src/lib/voice/chat/settings';
import type {
  ChatBody,
  ChatEvent,
  ChatRequest,
  Ran,
  ToolEnv,
  ToolMark,
} from '../src/lib/voice/chat/types';
import type { Screen } from '../src/lib/voice/screen/shape';
import type { Listed, TrackList } from '../src/lib/voice/track-lists';
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
  superlikes: number;
  room: string | null;
  notes: string[];
  values: Record<SettingKey, SettingValue>;
  found: Entity[];
  queue: Brief[];
  lists: Partial<Record<TrackList, Listed[]>>;
  view: Screen;
  rows: number;
  looking: ButtonPlace;
  placed: Record<ButtonPlace, Placed[]>;
}

const SURFACES: Record<ButtonPlace, Surface> = { bar: 'player', home: 'deck' };

export function fakeApp(): FakeApp {
  const calls: string[] = [];
  const app: FakeApp = {
    calls,
    superlikes: 1,
    room: null,
    notes: [],
    found: [],
    lists: {},
    rows: 3,
    looking: 'bar',
    placed: { bar: defaultPlacement('player'), home: defaultPlacement('deck') },
    view: {
      page: 'search',
      title: 'Поиск',
      tracks: [{ n: 1, title: 'gothrussia', artist: 'Psychosis', id: 'soundcloud:tracks:2' }],
      controls: [
        { ref: 'c1', role: 'tab', label: 'Треки', current: true },
        { ref: 'c2', role: 'field', label: 'Поиск', value: 'гот раша' },
      ],
      more_below: true,
    },
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
      home_cover_opacity: 100,
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
    listTracks: async (list, from, count, artist) => {
      calls.push(`list:${list}:${from}:${count}${artist ? `:${artist}` : ''}`);
      const all = app.lists[list] ?? [];
      const kept = artist ? all.filter((track) => track.artist === artist) : all;
      return kept.slice(from - 1, from - 1 + count);
    },
    screen: async () => {
      calls.push('screen');
      return app.view;
    },
    press: (ref) => {
      calls.push(`press:${ref}`);
      return app.view.controls.some((c) => c.ref === ref);
    },
    typeInto: (ref, text, submit) => {
      calls.push(`type:${ref}:${text}:${submit}`);
      return app.view.controls.some((c) => c.ref === ref && c.role === 'field');
    },
    scroll: async (to) => {
      calls.push(`scroll:${to}`);
      return { ...app.view, more_below: to !== 'bottom' };
    },
    playRow: (n) => {
      calls.push(`row:${n}`);
      return n >= 1 && n <= app.rows;
    },
    openItem: (kind, id) => {
      calls.push(`item:${kind}:${id}`);
      return id.length > 0;
    },
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
      const res = addNote(app.notes, note);
      app.notes = res.notes;
      return res.state;
    },
    forget: (note) => {
      const res = dropNote(app.notes, note);
      app.notes = res.notes;
      return res.state;
    },
    setSleep: (plan) => {
      calls.push(`sleep:${typeof plan === 'string' ? plan : plan.minutes}`);
    },
    setEffect: (effect) => {
      calls.push(`effect:${effect}`);
    },
    dislike: async (on) => {
      calls.push(`dislike:${on}`);
      return 'ok';
    },
    superlike: (on) => {
      calls.push(`superlike:${on}`);
      if (!on) return 'ok';
      if (app.superlikes === 0) return 'quota_full';
      app.superlikes -= 1;
      return 'ok';
    },
    together: async ({ act, code, host, open }) => {
      calls.push(`together:${act}:${code}:${host}:${open}`);
      if (app.room) {
        if (act === 'start' || act === 'join') return { state: 'in_room' };
        const was = app.room;
        if (act === 'leave') app.room = null;
        return { state: 'ok', code: act === 'leave' ? null : was };
      }
      if (act !== 'start' && act !== 'join') return { state: 'no_room' };
      if (act === 'join' && code && code.length !== 6) return { state: 'bad_code' };
      if (act === 'join' && !code && host && host !== 'Mira') return { state: 'no_open_room' };
      app.room = act === 'join' ? code || 'OPEN42' : 'K7M2QP';
      return { state: 'ok', code: app.room };
    },
    openRooms: async () => {
      calls.push('open_rooms');
      return [{ host: 'Mira', track: 'Faded - Psychosis', listeners: 3, capacity: 8, full: false }];
    },
    buttons: () => ({
      bar: placementMap(app.placed.bar, 'player'),
      home: placementMap(app.placed.home, 'deck'),
    }),
    placeButton: ({ place, button, act, zone, position }) => {
      const where = place ?? app.looking;
      calls.push(`button:${where}:${button}:${act}:${zone ?? ''}:${position ?? ''}`);
      const done = arrange(app.placed[where], SURFACES[where], button, act, zone, position);
      if (done.state !== 'ok') return done;
      app.placed[where] = done.entries;
      return {
        state: 'ok',
        place: where,
        zone: done.zone,
        position: done.position,
        hidden: done.hidden,
      };
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
    ask: false,
    talk: null,
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
    quiet: false,
  };
}

export function ranOf(name: string, returns: boolean, result: Ran['result'] = { ok: true }): Ran {
  const mark: ToolMark = { tool: name, ok: result.ok };
  return { name, args: {}, result, returns, mark };
}
