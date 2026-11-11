import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BLOCK_BYTES,
  buildBody,
  bytesOf,
  HISTORY_MAX,
  NOTES_MAX,
  TEXT_MAX,
  TOOLS_MAX,
} from '../src/lib/voice/chat/body.ts';
import { buildContext } from '../src/lib/voice/chat/context.ts';
import {
  DIALOG_TTL_MS,
  DIALOG_TURNS,
  dialogMessages,
  type Exchange,
  liveDialog,
  withExchange,
} from '../src/lib/voice/chat/dialog.ts';
import { addNote, dropNote, NOTE_MAX, NOTES_CAP } from '../src/lib/voice/chat/notes.ts';
import { pageName, pageTarget } from '../src/lib/voice/chat/pages.ts';
import { chatTools } from '../src/lib/voice/chat/tools/index.ts';
import type { CallResult, ChatMessage, ChatTool } from '../src/lib/voice/chat/types';
import { fakeApp } from './voice-chat-fakes.ts';
import { fakePort } from './voice-fake-port.ts';

const NOW = 10_000_000;

function input(extra: Partial<Parameters<typeof buildBody>[0]> = {}) {
  return {
    text: 'как дела',
    persona: 'loli',
    language: 'ru' as const,
    context: { playing: true },
    history: [] as ChatMessage[],
    notes: [] as string[],
    tools: chatTools(fakePort(), fakeApp()),
    results: [] as CallResult[],
    ...extra,
  };
}

function exchange(n: number, at: number): Exchange {
  return { at, user: `вопрос ${n}`, assistant: `ответ ${n}` };
}

test('the body carries text, persona, language, context, history, notes, tools and results', () => {
  const body = buildBody(input({ notes: ['Любит джаз'] }));
  assert.deepEqual(Object.keys(body), [
    'text',
    'persona',
    'language',
    'context',
    'history',
    'notes',
    'tools',
    'results',
  ]);
  assert.equal(body.persona, 'loli');
  assert.equal(body.language, 'ru');
  assert.deepEqual(body.results, []);
  assert.deepEqual(Object.keys(body.tools[0]), ['name', 'description', 'args', 'returns']);
  assert.ok(bytesOf(body) < 256 * 1024);
});

test('text is cut by characters, not by code units', () => {
  const body = buildBody(input({ text: `  ${'🎧'.repeat(TEXT_MAX + 20)}  ` }));
  assert.equal(Array.from(body.text).length, TEXT_MAX);
  assert.ok(!body.text.includes('�'));
});

test('history keeps the latest messages and starts with the user', () => {
  const history: ChatMessage[] = Array.from({ length: 31 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    text: `m${i}`,
  }));
  const body = buildBody(input({ history }));
  assert.ok(body.history.length <= HISTORY_MAX);
  assert.equal(body.history[0].role, 'user');
  assert.equal(body.history[body.history.length - 1].text, 'm30');
  const long = buildBody(input({ history: [{ role: 'user', text: 'я'.repeat(900) }] }));
  assert.equal(long.history[0].text.length, TEXT_MAX);
});

test('notes and tools are capped', () => {
  const notes = Array.from({ length: 40 }, (_, i) => `факт ${i}`);
  const tool = chatTools(fakePort(), fakeApp())[0];
  const tools: ChatTool[] = Array.from({ length: 80 }, (_, i) => ({ ...tool, name: `t${i}` }));
  const body = buildBody(input({ notes, tools }));
  assert.equal(body.notes.length, NOTES_MAX);
  assert.equal(body.notes[NOTES_MAX - 1], 'факт 39');
  assert.equal(body.tools.length, TOOLS_MAX);
});

test('an oversized context drops the queue, then the track, never the limit', () => {
  const big = 'x'.repeat(BLOCK_BYTES);
  const queue = buildBody(input({ context: { playing: true, queue_next: [big] } }));
  assert.deepEqual(queue.context, { playing: true });
  const track = buildBody(
    input({ context: { playing: true, queue_next: [], now_playing: { title: big } } }),
  );
  assert.deepEqual(track.context, { playing: true });
  const hopeless = buildBody(input({ context: { page: big } }));
  assert.deepEqual(hopeless.context, {});
});

test('results stay under the limit: the newest are kept, a huge one is replaced', () => {
  const small = (n: number): CallResult => ({
    name: 'search',
    args: { query: `q${n}` },
    result: { ok: true, matches: ['x'.repeat(3000)] },
  });
  const kept = buildBody(input({ results: [small(1), small(2), small(3)] })).results;
  assert.ok(bytesOf(kept) <= BLOCK_BYTES);
  assert.deepEqual(
    kept.map((r) => r.args.query),
    ['q2', 'q3'],
  );
  const huge: CallResult = {
    name: 'search',
    args: {},
    result: { ok: true, blob: 'x'.repeat(9000) },
  };
  assert.deepEqual(buildBody(input({ results: [huge] })).results, [
    { name: 'search', args: {}, result: { ok: false, reason: 'too_large' } },
  ]);
});

test('the real tool list and a full context fit the request limits', () => {
  const tools = chatTools(fakePort(), fakeApp());
  assert.ok(bytesOf(tools) < 16 * 1024);
  const context = buildContext({
    track: { title: 'Положение', artist: 'Скриптонит' },
    liked: true,
    position: 61.4,
    duration: 200.2,
    playing: true,
    volume: 80,
    shuffle: false,
    repeat: 'all',
    next: Array.from({ length: 9 }, (_, i) => ({ title: `T${i}`, artist: 'A' })),
    page: 'likes',
    now: new Date(2026, 10, 11, 8, 5),
    appLanguage: 'ru',
  });
  assert.deepEqual(context.now_playing, {
    title: 'Положение',
    artist: 'Скриптонит',
    liked: true,
    position: 61,
    duration: 200,
  });
  assert.equal((context.queue_next as unknown[]).length, 5);
  assert.equal(context.time, '2026-11-11 08:05');
  assert.equal(context.weekday, 'Wednesday');
  assert.equal(context.page, 'likes');
  assert.equal(context.app_language, 'ru');
  assert.ok(!('user' in context));
  assert.ok(bytesOf(context) < BLOCK_BYTES);
  const idle = buildContext({
    track: null,
    liked: false,
    position: 0,
    duration: 0,
    playing: false,
    volume: 50,
    shuffle: false,
    repeat: 'off',
    next: [],
    page: 'home',
    now: new Date(2026, 10, 15, 23, 59),
    appLanguage: 'en',
  });
  assert.equal(idle.now_playing, null);
  assert.equal(idle.weekday, 'Sunday');
});

test('the dialog lives for 30 minutes of silence and keeps the last turns', () => {
  let dialog: Exchange[] = [];
  for (let n = 0; n < DIALOG_TURNS + 4; n++) dialog = withExchange(dialog, exchange(n, NOW + n));
  assert.equal(dialog.length, DIALOG_TURNS);
  assert.equal(dialog[0].user, 'вопрос 4');
  const last = dialog[dialog.length - 1].at;
  assert.equal(liveDialog(dialog, last + DIALOG_TTL_MS).length, DIALOG_TURNS);
  assert.deepEqual(liveDialog(dialog, last + DIALOG_TTL_MS + 1), []);
  assert.deepEqual(dialogMessages(dialog, last + DIALOG_TTL_MS + 1), []);
  const messages = dialogMessages(dialog, last + 1000);
  assert.equal(messages.length, DIALOG_TURNS * 2);
  assert.deepEqual(messages.slice(-2), [
    { role: 'user', text: 'вопрос 13' },
    { role: 'assistant', text: 'ответ 13' },
  ]);
});

test('a new exchange after the silence starts the dialog over; empty replies are not kept', () => {
  const old = withExchange([], exchange(1, NOW));
  const fresh = withExchange(old, exchange(2, NOW + DIALOG_TTL_MS + 5));
  assert.deepEqual(
    fresh.map((e) => e.user),
    ['вопрос 2'],
  );
  const silent = withExchange(fresh, {
    at: NOW + DIALOG_TTL_MS + 9,
    user: 'пауза',
    assistant: ' ',
  });
  assert.equal(silent.length, 1);
});

test('notes: trimmed, deduplicated, capped, the oldest goes first', () => {
  let notes: string[] = [];
  notes = addNote(notes, '  Любит   джаз. ');
  assert.deepEqual(notes, ['Любит джаз.']);
  assert.equal(addNote(notes, '   '), notes);
  notes = addNote(notes, 'Зовут Аня');
  notes = addNote(notes, 'любит джаз');
  assert.deepEqual(notes, ['Зовут Аня', 'любит джаз']);
  assert.equal(Array.from(addNote([], 'я'.repeat(400))[0]).length, NOTE_MAX);
  for (let n = 0; n < NOTES_CAP + 5; n++) notes = addNote(notes, `факт ${n}`);
  assert.equal(notes.length, NOTES_CAP);
  assert.equal(notes[0], 'факт 5');
  assert.equal(notes[NOTES_CAP - 1], `факт ${NOTES_CAP + 4}`);
});

test('notes: forget by the same text, or by a part that fits one note only', () => {
  const notes = ['Зовут Аня', 'Любит джаз и босса-нову', 'Не любит рэп', 'Любит'];
  assert.deepEqual(dropNote(notes, 'зовут аня.'), { notes: notes.slice(1), state: 'ok' });
  assert.deepEqual(dropNote(notes, 'джаз'), {
    notes: ['Зовут Аня', 'Не любит рэп', 'Любит'],
    state: 'ok',
  });
  assert.deepEqual(dropNote(notes, 'любит'), {
    notes: ['Зовут Аня', 'Любит джаз и босса-нову', 'Не любит рэп'],
    state: 'ok',
  });
});

test('notes: a part that fits several notes removes none of them', () => {
  const notes = ['Зовут Аня', 'Любит джаз и босса-нову', 'Не любит рэп'];
  assert.deepEqual(dropNote(notes, 'любит'), { notes, state: 'ambiguous' });
  assert.deepEqual(dropNote(notes, 'металл'), { notes, state: 'not_found' });
  assert.deepEqual(dropNote(notes, 'а'), { notes, state: 'not_found' });
  assert.deepEqual(dropNote(notes, '  '), { notes, state: 'not_found' });
});

test('pages map to routes; pages of the current track need one', () => {
  const none = { track: null, artist: null, album: null };
  assert.deepEqual(pageTarget('likes', null, none), { to: '/library/likes' });
  assert.deepEqual(pageTarget('home', null, none), { to: '/home' });
  assert.deepEqual(pageTarget('settings', 'audio', none), {
    to: '/settings',
    state: { category: 'audio' },
  });
  assert.deepEqual(pageTarget('settings', null, none), { to: '/settings', state: undefined });
  assert.equal(pageTarget('current_artist', null, none), null);
  const links = { track: '/track/1', artist: '/artist/a1', album: null };
  assert.deepEqual(pageTarget('current_artist', null, links), { to: '/artist/a1' });
  assert.equal(pageTarget('current_album', null, links), null);
});

test('the page in the context is a name, never a path with ids', () => {
  const names: Record<string, string> = {
    '/home': 'home',
    '/library': 'library',
    '/library/likes': 'likes',
    '/library/history/': 'history',
    '/library/unknown': 'library',
    '/settings': 'settings',
    '/chats': 'chats',
    '/chats/storage': 'chats',
    '/chats/8f2c1e0a-77aa': 'chats',
    '/user/soundcloud:users:12345': 'artist',
    '/artist/a1': 'artist',
    '/track/soundcloud:tracks:777': 'track',
    '/playlist/soundcloud:playlists:5': 'playlist',
    '/album/al9': 'album',
    '/star': 'other',
    '/': 'other',
    '': 'other',
  };
  for (const [path, name] of Object.entries(names)) assert.equal(pageName(path), name, path);
});
