import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readArgs } from '../src/lib/voice/chat/args.ts';
import { NOTES_CAP } from '../src/lib/voice/chat/notes.ts';
import { parseSetting, SETTING_KEYS } from '../src/lib/voice/chat/settings.ts';
import { chatTools, runTool, toolsOf } from '../src/lib/voice/chat/tools/index.ts';
import type { ChatTool } from '../src/lib/voice/chat/types';
import type { Entity } from '../src/lib/voice/types';
import { fakeApp, TRACK, toolEnv } from './voice-chat-fakes.ts';
import { ARTIST, command, fakePort } from './voice-fake-port.ts';

const NAME = /^[a-z][a-z0-9_]{0,31}$/;
const PRIMITIVES = ['string', 'number', 'integer', 'boolean'];

function setup(player = fakePort(), offered: Entity[] = []) {
  const app = fakeApp();
  const tools = chatTools(player, app, offered);
  const env = toolEnv();
  const run = (name: string, args: unknown = {}) => runTool(tools, name, args, env);
  return { player, app, tools, env, run };
}

test('every tool has a valid unique name, a flat primitive schema and a short description', () => {
  const { tools } = setup();
  assert.equal(new Set(tools.map((t) => t.name)).size, tools.length);
  assert.ok(tools.length <= 64);
  for (const tool of tools) {
    assert.match(tool.name, NAME);
    assert.ok(tool.description.length > 10 && tool.description.length <= 480, tool.name);
    assert.equal(tool.args.type, 'object');
    for (const [name, spec] of Object.entries(tool.args.properties)) {
      assert.ok(PRIMITIVES.includes(spec.type), `${tool.name}.${name}`);
      assert.deepEqual(
        Object.keys(spec).filter((key) => key !== 'type' && key !== 'enum'),
        [],
      );
    }
    for (const name of tool.args.required) assert.ok(name in tool.args.properties);
  }
});

test('only the tools the model must hear back from ask for another round', () => {
  const { tools } = setup();
  assert.deepEqual(
    tools.filter((t) => t.returns).map((t) => t.name),
    ['play', 'queue_add', 'search', 'get_settings', 'queue_list'],
  );
});

test('every tool has a chip label in all five interface languages and none is left over', () => {
  const { tools } = setup();
  const names = tools.map((t) => t.name).sort();
  for (const lang of ['en', 'ru', 'tr', 'ko', 'pt']) {
    const file = new URL(`../src/i18n/locales/voice/${lang}.json`, import.meta.url);
    const labels: Record<string, string> = JSON.parse(readFileSync(file, 'utf8')).voice.chat.tools;
    assert.deepEqual(Object.keys(labels).sort(), names, lang);
    for (const name of names) assert.ok(labels[name].trim(), `${lang}: ${name}`);
  }
});

test('a failed action always goes back to the model, an unknown tool never does', async () => {
  const { app, run } = setup(fakePort({ track: null, queue: [] }));
  assert.equal((await run('lyrics', { open: true })).returns, false);
  assert.equal((await run('like', { on: true })).returns, true);
  assert.equal((await run('volume', { mode: 'louder' })).returns, true);
  app.notes = ['Любит джаз', 'Любит рок'];
  assert.equal((await run('forget', { note: 'любит' })).returns, true);
  assert.equal((await run('forget', { note: 'Любит рок' })).returns, false);
  assert.equal((await run('format_disk')).returns, false);
});

test('arguments are checked against the schema before a tool runs', () => {
  const schema: ChatTool['args'] = {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['set', 'up'] },
      value: { type: 'number' },
      whole: { type: 'integer' },
      on: { type: 'boolean' },
    },
    required: ['mode'],
  };
  assert.deepEqual(readArgs(schema, { mode: 'SET', value: '40', whole: 2.6, on: 'true', x: 1 }), {
    ok: true,
    args: { mode: 'set', value: 40, whole: 3, on: true },
  });
  assert.deepEqual(readArgs(schema, { mode: 'up', value: null }), {
    ok: true,
    args: { mode: 'up' },
  });
  assert.deepEqual(readArgs(schema, { mode: 'sideways' }), { ok: false, reason: 'bad_args:mode' });
  assert.deepEqual(readArgs(schema, {}), { ok: false, reason: 'bad_args:mode' });
  assert.deepEqual(readArgs(schema, { mode: 'set', value: 'loud' }), {
    ok: false,
    reason: 'bad_args:value',
  });
  assert.deepEqual(readArgs(schema, { mode: 'set', on: 1 }), { ok: false, reason: 'bad_args:on' });
  assert.deepEqual(readArgs(schema, 'pause'), { ok: false, reason: 'bad_args:mode' });
});

test('unknown tools and bad arguments are results, not errors', async () => {
  const { player, run } = setup();
  const unknown = await run('format_disk');
  assert.deepEqual(unknown.result, { ok: false, reason: 'unknown_tool' });
  assert.equal(unknown.mark.ok, false);
  const bad = await run('volume', { mode: 'louder' });
  assert.deepEqual(bad.result, { ok: false, reason: 'bad_args:mode' });
  const noValue = await run('volume', { mode: 'set' });
  assert.deepEqual(noValue.result, { ok: false, reason: 'bad_args:value' });
  assert.deepEqual(player.calls, []);
});

test('a tool that throws becomes a failed result', async () => {
  const player = fakePort();
  player.playWave = async () => {
    throw new Error('offline');
  };
  const { run } = setup(player);
  const ran = await run('play_wave');
  assert.deepEqual(ran.result, { ok: false, reason: 'failed' });
});

test('player tools go through the executor: port calls, undo steps and display text', async () => {
  const { player, env, run } = setup(fakePort({ volume: 40, position: 30 }));
  const set = await run('volume', { mode: 'set', value: 250 });
  assert.equal(player.state.volume, 200);
  assert.deepEqual(set.mark, {
    tool: 'volume',
    ok: true,
    intent: 'volume_set',
    kind: undefined,
    text: 'Громкость 200',
  });
  await run('volume', { mode: 'down', value: 20 });
  assert.equal(player.state.volume, 180);
  await run('seek', { mode: 'forward', seconds: 15 });
  await run('seek', { mode: 'to', seconds: 90 });
  await run('like', { on: true });
  await run('shuffle', { on: true });
  await run('repeat', { mode: 'one' });
  await run('pause');
  await run('next');
  assert.deepEqual(player.calls, [
    'volume:200',
    'volume:180',
    'seek:45',
    'seek:90',
    'liked:true',
    'shuffle:true',
    'repeat:one',
    'pause',
    'next',
  ]);
  assert.equal(env.undo, true);
  assert.equal(env.stack.length, 1);
  assert.equal(env.stack[0].id, 'turn-1');
  assert.equal(env.stack[0].steps.length, 9);
});

test('tools that need a track say so when nothing plays', async () => {
  const { player, run } = setup(fakePort({ track: null, queue: [] }));
  for (const [name, args] of [
    ['pause', {}],
    ['like', { on: true }],
    ['seek', { mode: 'forward', seconds: 5 }],
    ['play_similar', {}],
    ['add_to_playlist', {}],
  ] as const) {
    const ran = await run(name, args);
    assert.deepEqual(ran.result, { ok: false, reason: 'nothing_playing' }, name);
  }
  assert.deepEqual(player.calls, []);
});

test('play by name resolves, starts the best match and returns what started', async () => {
  const { player, app, run } = setup();
  app.found = [ARTIST, TRACK];
  const ran = await run('play', { query: 'скриптонит' });
  assert.deepEqual(app.calls, ['resolve:скриптонит:track+artist+album+playlist']);
  assert.deepEqual(player.calls, ['play:artist:a1']);
  assert.deepEqual(ran.result, {
    ok: true,
    started: { kind: 'artist', name: 'Скриптонит', artist: '' },
  });
  assert.equal(ran.returns, true);
  assert.equal(ran.mark.kind, 'artist');
  const track = await run('queue_add', { query: 'положение', kind: 'track' });
  assert.deepEqual(track.result, {
    ok: true,
    queued: { kind: 'track', name: 'Положение', artist: 'Скриптонит' },
  });
  assert.deepEqual(player.calls, ['play:artist:a1', 'queue:t7']);
});

test('play by name reports nothing found without touching the player', async () => {
  const { player, run } = setup();
  const ran = await run('play', { query: 'абырвалг' });
  assert.deepEqual(ran.result, { ok: false, reason: 'not_found' });
  assert.deepEqual(player.calls, []);
  const empty = await run('play', { query: '   ' });
  assert.deepEqual(empty.result, { ok: false, reason: 'bad_args:query' });
});

test('search returns the top matches and play_found only plays what search returned', async () => {
  const { player, app, run } = setup();
  app.found = [TRACK, ARTIST, ...[1, 2, 3, 4, 5].map((n) => ({ ...TRACK, id: `x${n}` }))];
  const found = await run('search', { query: 'скрип' });
  const matches = found.result.matches as { id: string }[];
  assert.equal(matches.length, 5);
  assert.deepEqual(matches[0], {
    kind: 'track',
    name: 'Положение',
    artist: 'Скриптонит',
    popularity: 9,
    id: 't7',
  });
  assert.deepEqual(player.calls, []);
  const played = await run('play_found', { kind: 'track', id: 't7' });
  assert.equal(played.result.ok, true);
  assert.equal(played.mark.text, 'Скриптонит — Положение');
  const queued = await run('play_found', { kind: 'artist', id: 'a1', queue: true });
  assert.equal(queued.result.ok, true);
  const stranger = await run('play_found', { kind: 'track', id: 'x5' });
  assert.deepEqual(stranger.result, { ok: false, reason: 'unknown_id' });
  assert.deepEqual(player.calls, ['play:track:t7', 'queue:a1']);
});

test('play_found also plays what the command offered, and nothing else without a search', async () => {
  const offered = setup(fakePort(), [TRACK, ARTIST]);
  const played = await offered.run('play_found', { kind: 'track', id: 't7' });
  assert.deepEqual(played.result, {
    ok: true,
    started: { kind: 'track', name: 'Положение', artist: 'Скриптонит' },
  });
  const queued = await offered.run('play_found', { kind: 'artist', id: 'a1', queue: true });
  assert.equal(queued.result.ok, true);
  const wrongKind = await offered.run('play_found', { kind: 'album', id: 't7' });
  assert.deepEqual(wrongKind.result, { ok: false, reason: 'unknown_id' });
  assert.deepEqual(offered.player.calls, ['play:track:t7', 'queue:a1']);
  const bare = setup();
  const stranger = await bare.run('play_found', { kind: 'track', id: 't7' });
  assert.deepEqual(stranger.result, { ok: false, reason: 'unknown_id' });
  assert.deepEqual(bare.player.calls, []);
  assert.match(
    bare.tools.find((t) => t.name === 'play_found')?.description ?? '',
    /search results or from context\.candidates/,
  );
});

test('navigation passes the page, query and settings section to the app', async () => {
  const { app, run } = setup();
  assert.equal((await run('open_page', { page: 'likes' })).result.ok, true);
  await run('open_page', { page: 'search', query: 'ambient' });
  await run('open_page', { page: 'settings', section: 'voice' });
  const missing = await run('open_page', { page: 'current_album' });
  assert.deepEqual(missing.result, { ok: false, reason: 'no_page' });
  const bad = await run('open_page', { page: 'admin' });
  assert.deepEqual(bad.result, { ok: false, reason: 'bad_args:page' });
  assert.deepEqual(app.calls, [
    'open:likes::',
    'open:search:ambient:',
    'open:settings::voice',
    'open:current_album::',
  ]);
});

test('settings: only whitelisted keys, values parsed and validated per key', async () => {
  const { app, run } = setup();
  const read = await run('get_settings');
  const settings = read.result.settings as Record<string, unknown>;
  assert.deepEqual(Object.keys(settings), SETTING_KEYS);
  assert.equal(settings.equalizer, 'off');
  assert.equal(settings.theme, 'dark');
  assert.deepEqual((await run('set_setting', { key: 'theme', value: 'White' })).result, {
    ok: true,
    key: 'theme',
    value: 'white',
  });
  assert.deepEqual((await run('set_setting', { key: 'crossfade', value: '30' })).result, {
    ok: true,
    key: 'crossfade',
    value: 12,
  });
  await run('set_setting', { key: 'equalizer', value: 'on' });
  const wrong = await run('set_setting', { key: 'theme', value: 'blue' });
  assert.deepEqual(wrong.result, { ok: false, reason: 'bad_value', allowed: 'dark|white|system' });
  const closed = await run('set_setting', { key: 'customCss', value: 'x' });
  assert.deepEqual(closed.result, { ok: false, reason: 'bad_args:key' });
  assert.deepEqual(app.calls, ['set:theme:white', 'set:crossfade:12', 'set:equalizer:true']);
  for (const key of SETTING_KEYS) {
    assert.doesNotMatch(key, /account|network|proxy|session|token|css|cache|discord|scrobble/i);
  }
});

test('setting values: switches, choices and ranges', () => {
  assert.equal(parseSetting('autoplay', 'ON'), true);
  assert.equal(parseSetting('autoplay', 'off'), false);
  assert.equal(parseSetting('autoplay', 'maybe'), null);
  assert.equal(parseSetting('equalizer_preset', 'bassboost'), 'bassBoost');
  assert.equal(parseSetting('stream_quality', 'ultra'), null);
  assert.equal(parseSetting('voice_speed', '1,17'), 1.15);
  assert.equal(parseSetting('voice_speed', '9'), 1.3);
  assert.equal(parseSetting('crossfade', ''), null);
});

test('speed, lyrics, queue and the playlist picker call the app', async () => {
  const { app, run } = setup();
  assert.deepEqual((await run('speed', { rate: 3 })).result, { ok: true, rate: 2 });
  await run('lyrics', { open: true });
  const next = await run('queue_list');
  assert.deepEqual(next.result, { ok: true, next: [{ title: 'Track 2', artist: 'Скриптонит' }] });
  await run('queue_clear');
  await run('add_to_playlist');
  assert.deepEqual(app.calls, ['speed:2', 'lyrics:true', 'queue_clear', 'pick_playlist']);
});

test('remember and forget keep notes through the app', async () => {
  const { app, run } = setup();
  assert.deepEqual((await run('remember', { note: 'Любит джаз' })).result, { ok: true });
  assert.deepEqual(app.notes, ['Любит джаз']);
  assert.deepEqual((await run('forget', { note: 'Любит джаз' })).result, { ok: true });
  assert.deepEqual((await run('forget', { note: 'Любит рок' })).result, {
    ok: false,
    reason: 'not_found',
  });
  app.notes = ['Любит джаз', 'Любит рок', 'Зовут Аня'];
  assert.deepEqual((await run('forget', { note: 'любит' })).result, {
    ok: false,
    reason: 'ambiguous',
  });
  assert.equal(app.notes.length, 3);
  assert.deepEqual((await run('forget', { note: 'аня' })).result, { ok: true });
  assert.deepEqual(app.notes, ['Любит джаз', 'Любит рок']);
  assert.deepEqual((await run('remember', {})).result, { ok: false, reason: 'bad_args:note' });
});

test('remember refuses when the memory is full and evicts nothing', async () => {
  const { app, run } = setup();
  const full = Array.from({ length: NOTES_CAP }, (_, n) => `факт ${n}`);
  app.notes = full;
  assert.deepEqual((await run('remember', { note: 'Любит джаз' })).result, {
    ok: false,
    reason: 'full',
  });
  assert.deepEqual(app.notes, full);
  await run('forget', { note: 'факт 0' });
  assert.deepEqual((await run('remember', { note: 'Любит джаз' })).result, { ok: true });
  assert.equal(app.notes.length, NOTES_CAP);
});

test('undo reverts the last voice action and reports when there is none', async () => {
  const { player, env, run } = setup(fakePort({ volume: 40 }));
  assert.deepEqual((await run('undo')).result, { ok: false, reason: 'nothing_to_undo' });
  await run('volume', { mode: 'set', value: 80 });
  const undone = await run('undo');
  assert.deepEqual(undone.result, { ok: true });
  assert.equal(undone.mark.intent, 'undo');
  assert.equal(player.state.volume, 40);
  assert.equal(env.stack.length, 0);
});

test('a phrase heard as talk is offered no tools, any other phrase is offered all of them', () => {
  const all = chatTools(fakePort(), fakeApp(), []).map((t) => t.name);
  const offered = (talk: boolean) => toolsOf(command('none', { talk }), fakePort(), fakeApp());
  assert.deepEqual(offered(true), []);
  assert.deepEqual(
    offered(false).map((t) => t.name),
    all,
  );
});
