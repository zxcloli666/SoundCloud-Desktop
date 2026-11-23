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
  const ask = (name: string, args: unknown = {}) => runTool(tools, name, args, env);
  const run = async (name: string, args: unknown = {}) => {
    const ran = await ask(name, args);
    assert.ok(ran, name);
    return ran;
  };
  return { player, app, tools, env, run, ask };
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
    [
      'play',
      'queue_add',
      'search',
      'list_tracks',
      'get_settings',
      'queue_list',
      'screen',
      'scroll',
      'player_buttons',
      'together',
      'open_rooms',
    ],
  );
});

test('every tool has a chip label in every interface language and none is left over', () => {
  const { tools } = setup();
  const names = tools.map((t) => t.name).sort();
  for (const lang of ['en', 'ru', 'es', 'fr', 'tr', 'ko', 'pt']) {
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

test('a name already started or queued in this turn is not started or queued again', async () => {
  const { player, app, run, ask } = setup();
  app.found = [ARTIST, TRACK];
  await run('queue_add', { query: 'Положение', kind: 'track' });
  assert.equal(await ask('queue_add', { query: ' положение ' }), null);
  assert.equal(await ask('queue_add', { query: 'положение', kind: 'track' }), null);
  await run('play', { query: 'скриптонит' });
  assert.equal(await ask('play', { query: 'Скриптонит', kind: 'artist' }), null);
  assert.deepEqual(player.calls, ['queue:t7', 'play:artist:a1']);
  assert.equal(app.calls.length, 2);
});

test('the same name asked again as another kind or by the other tool is run', async () => {
  const { player, app, run } = setup();
  app.found = [ARTIST, TRACK];
  await run('play', { query: 'скриптонит' });
  const track = await run('play', { query: 'скриптонит', kind: 'track' });
  assert.deepEqual(track.result, {
    ok: true,
    started: { kind: 'track', name: 'Положение', artist: 'Скриптонит' },
  });
  await run('queue_add', { query: 'скриптонит' });
  assert.deepEqual(player.calls, ['play:artist:a1', 'play:track:t7', 'queue:a1']);
});

test('a name that was not found can be asked again', async () => {
  const { player, app, run } = setup();
  const missed = await run('play', { query: 'найткол' });
  assert.deepEqual(missed.result, { ok: false, reason: 'not_found' });
  app.found = [TRACK];
  const found = await run('play', { query: 'найткол' });
  assert.equal(found.result.ok, true);
  assert.deepEqual(player.calls, ['play:track:t7']);
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

test('ask_user and talk_mode only mark the turn for the engine', async () => {
  const { app, env, run } = setup();
  assert.equal((await run('ask_user')).returns, false);
  assert.equal(env.ask, true);
  assert.equal(env.talk, null);
  await run('talk_mode', { on: true });
  assert.equal(env.talk, true);
  await run('talk_mode', { on: false });
  assert.equal(env.talk, false);
  assert.deepEqual(app.calls, []);
});

test('the sleep timer pauses later, at the track end or turns off', async () => {
  const { app, run } = setup();
  assert.deepEqual((await run('sleep_timer', { when: 'minutes', minutes: 30 })).result, {
    ok: true,
    minutes: 30,
  });
  await run('sleep_timer', { when: 'track_end' });
  await run('sleep_timer', { when: 'off' });
  const wrong = await run('sleep_timer', { when: 'minutes', minutes: 0 });
  assert.equal(wrong.result.reason, 'bad_minutes');
  assert.equal(wrong.returns, true);
  assert.deepEqual(app.calls, ['sleep:30', 'sleep:track_end', 'sleep:off']);
});

test('the sleep timer needs something playing, but turning it off never does', async () => {
  const { app, run } = setup(fakePort({ track: null, queue: [] }));
  assert.equal(
    (await run('sleep_timer', { when: 'minutes', minutes: 15 })).result.reason,
    'nothing_playing',
  );
  assert.equal((await run('sleep_timer', { when: 'off' })).result.ok, true);
  assert.deepEqual(app.calls, ['sleep:off']);
});

test('player buttons list each zone of the bar and the Home deck', async () => {
  const { run } = setup();
  const ran = await run('player_buttons');
  assert.equal(ran.returns, true);
  const { bar, home } = ran.result as unknown as Record<string, Record<string, string[]>>;
  assert.deepEqual(bar.left, ['like']);
  assert.deepEqual(bar.before, ['shuffle']);
  assert.deepEqual(bar.after, ['repeat']);
  assert.deepEqual(bar.right, ['together', 'lyrics', 'queue', 'volume']);
  assert.equal(bar.title, undefined);
  assert.deepEqual(home.title, ['queue']);
  assert.deepEqual(home.right, ['together', 'lyrics', 'volume']);
  assert.ok(bar.hidden.includes('eq'));
});

test('a player button moves, hides and shows on the bar or the Home deck', async () => {
  const { app, run } = setup();
  const moved = await run('player_button', {
    button: 'like',
    act: 'move',
    zone: 'after',
    position: 1,
  });
  assert.equal(moved.returns, false);
  assert.deepEqual(moved.result, {
    ok: true,
    place: 'bar',
    zone: 'after',
    position: 1,
    hidden: false,
  });
  assert.deepEqual(app.buttons().bar.after, ['like', 'repeat']);
  assert.deepEqual(app.buttons().bar.left, []);
  const titled = await run('player_button', {
    button: 'lyrics',
    act: 'move',
    place: 'home',
    zone: 'title',
  });
  assert.deepEqual(titled.result, {
    ok: true,
    place: 'home',
    zone: 'title',
    position: 2,
    hidden: false,
  });
  assert.deepEqual(app.buttons().bar.right, ['together', 'lyrics', 'queue', 'volume']);
  const hidden = await run('player_button', { button: 'volume', act: 'hide' });
  assert.deepEqual(hidden.result, { ok: true, place: 'bar', zone: 'right', hidden: true });
  assert.ok(app.buttons().bar.hidden.includes('volume'));
  await run('player_button', { button: 'eq', act: 'show', zone: 'before', position: 1 });
  assert.deepEqual(app.buttons().bar.before, ['eq', 'shuffle']);
  app.looking = 'home';
  await run('player_button', { button: 'queue', act: 'move', zone: 'right' });
  assert.deepEqual(app.buttons().home.right, ['together', 'volume', 'queue']);
});

test('a player button move is refused without a zone, outside its place or for fixed buttons', async () => {
  const { app, run } = setup();
  const nowhere = await run('player_button', { button: 'like', act: 'move' });
  assert.deepEqual(nowhere.result, { ok: false, reason: 'no_zone' });
  assert.equal(nowhere.returns, true);
  const title = await run('player_button', {
    button: 'like',
    act: 'move',
    place: 'bar',
    zone: 'title',
  });
  assert.equal(title.result.reason, 'bad_zone');
  assert.equal(
    (await run('player_button', { button: 'play', act: 'hide' })).result.reason,
    'bad_args:button',
  );
  assert.equal(
    (await run('player_button', { button: 'like', act: 'move', zone: 'right', position: 0 })).result
      .reason,
    'bad_position',
  );
  assert.deepEqual(app.buttons().bar.left, ['like']);
});

test('effects switch by name and an unknown effect is refused before the app', async () => {
  const { app, run } = setup();
  await run('effect', { name: 'slowed_reverb' });
  await run('effect', { name: 'off' });
  assert.equal((await run('effect', { name: 'vaporwave' })).result.reason, 'bad_args:name');
  assert.deepEqual(app.calls, ['effect:slowed_reverb', 'effect:off']);
});

test('dislike and superlike rate the current track and a full quota goes back to the model', async () => {
  const { app, run } = setup();
  assert.equal((await run('dislike', { on: true })).returns, false);
  assert.equal((await run('superlike', { on: true })).result.ok, true);
  const full = await run('superlike', { on: true });
  assert.deepEqual(full.result, { ok: false, reason: 'quota_full' });
  assert.equal(full.returns, true);
  await run('superlike', { on: false });
  assert.deepEqual(app.calls, [
    'dislike:true',
    'superlike:true',
    'superlike:true',
    'superlike:false',
  ]);
});

test('together opens a room with a copied invite, refuses a second one and leaves', async () => {
  const { app, run } = setup();
  assert.deepEqual((await run('together', { act: 'invite' })).result, {
    ok: false,
    reason: 'no_room',
  });
  assert.deepEqual((await run('together', { act: 'start' })).result, {
    ok: true,
    code: 'K7M2QP',
    invite_copied: true,
  });
  assert.equal((await run('together', { act: 'join', code: 'ABC234' })).result.reason, 'in_room');
  assert.deepEqual((await run('together', { act: 'leave' })).result, { ok: true, code: null });
  assert.equal((await run('together', { act: 'join', code: 'AB' })).result.reason, 'bad_code');
  assert.deepEqual(app.calls, [
    'together:invite:::false',
    'together:start:::false',
    'together:join:ABC234::false',
    'together:leave:::false',
    'together:join:AB::false',
  ]);
});

test('open rooms go back to the model and a public room is joined by its host or any', async () => {
  const { app, run } = setup();
  assert.deepEqual((await run('open_rooms', {})).result, {
    ok: true,
    rooms: [{ host: 'Mira', track: 'Faded - Psychosis', listeners: 3, capacity: 8, full: false }],
  });
  assert.equal(
    (await run('together', { act: 'join', host: 'Oleg' })).result.reason,
    'no_open_room',
  );
  assert.deepEqual((await run('together', { act: 'join', host: 'Mira' })).result, {
    ok: true,
    code: 'OPEN42',
  });
  assert.equal((await run('together', { act: 'visibility', open: true })).result.ok, true);
  await run('together', { act: 'leave' });
  assert.equal((await run('together', { act: 'join' })).result.code, 'OPEN42');
  assert.deepEqual(app.calls, [
    'open_rooms',
    'together:join::Oleg:false',
    'together:join::Mira:false',
    'together:visibility:::true',
    'together:leave:::false',
    'together:join:::false',
  ]);
});

function superlikes(count: number) {
  return Array.from({ length: count }, (_, at) => ({
    n: at + 1,
    title: `Super ${at + 1}`,
    artist: 'Psychosis',
    id: `soundcloud:tracks:${at + 1}`,
  }));
}

test('list_tracks reads a numbered page of a list and goes back to the model', async () => {
  const { app, run } = setup();
  app.lists.superlikes = superlikes(12);
  const read = await run('list_tracks', { list: 'superlikes', from: 9, count: 2 });
  assert.deepEqual(read.result, {
    ok: true,
    list: 'superlikes',
    from: 9,
    tracks: app.lists.superlikes.slice(8, 10),
  });
  assert.equal(read.returns, true);
  await run('list_tracks', { list: 'history' });
  await run('list_tracks', { list: 'likes', from: -3, count: 500 });
  assert.deepEqual(app.calls, ['list:superlikes:9:2', 'list:history:1:10', 'list:likes:1:30']);
  assert.equal((await run('list_tracks', { list: 'playlists' })).result.ok, false);
});

test('list_tracks with an artist keeps only their tracks with numbers of the whole list', async () => {
  const { app, run } = setup();
  const other = { n: 2, title: 'грааль', artist: 'smerrrt', id: 'soundcloud:tracks:2' };
  const wanted = { n: 3, title: 'gothrussia', artist: 'Psychosis', id: 'soundcloud:tracks:3' };
  app.lists.likes = [{ ...wanted, n: 1, title: 'soldier' }, other, wanted];
  const read = await run('list_tracks', { list: 'likes', artist: 'Psychosis' });
  assert.deepEqual(read.result, {
    ok: true,
    list: 'likes',
    from: 1,
    artist: 'Psychosis',
    tracks: [{ ...wanted, n: 1, title: 'soldier' }, wanted],
  });
  assert.deepEqual(app.calls, ['list:likes:1:10:Psychosis']);
});

test('play_list plays from a number of a list, and voice undo brings back what played', async () => {
  const { player, env, run } = setup();
  const played = await run('play_list', { list: 'superlikes', n: 9 });
  assert.deepEqual(played.result, { ok: true, started: 'Track 309' });
  assert.equal(played.returns, false);
  assert.equal(played.mark.intent, 'play');
  assert.equal(played.mark.text, 'Track 309');
  assert.deepEqual(player.calls, ['list:superlikes:9']);
  assert.equal(env.stack.length, 1);
  assert.equal(env.undo, true);
  assert.deepEqual((await run('undo')).result, { ok: true });
  assert.equal(player.state.track?.urn, 'soundcloud:tracks:1');
  assert.equal(player.state.queue.length, 3);
});

test('play_list jumps inside the queue and says so when the number is past its end', async () => {
  const { player, env, run } = setup();
  assert.equal((await run('play_list', { list: 'queue', n: 2 })).result.ok, true);
  assert.equal(player.state.track?.urn, 'soundcloud:tracks:3');
  const past = await run('play_list', { list: 'queue', n: 5 });
  assert.deepEqual(past.result, { ok: false, reason: 'not_found' });
  assert.equal(past.returns, true);
  assert.equal(env.stack.length, 1);
});

test('screen tools press, type and open through the app and fail on what is not there', async () => {
  const { app, run } = setup();
  assert.deepEqual((await run('screen')).result, { ok: true, screen: app.view });
  assert.deepEqual((await run('press', { ref: 'c1' })).result, { ok: true });
  assert.deepEqual((await run('press', { ref: 'c9' })).result, {
    ok: false,
    reason: 'unknown_ref',
  });
  const typed = await run('type_text', { ref: 'c2', text: 'психосис', submit: true });
  assert.deepEqual(typed.result, { ok: true });
  assert.equal((await run('type_text', { ref: 'c1', text: 'x' })).result.ok, false);
  const scrolled = await run('scroll', { to: 'bottom' });
  assert.equal(scrolled.returns, true);
  assert.deepEqual(scrolled.result, { ok: true, screen: { ...app.view, more_below: false } });
  assert.equal((await run('scroll', { to: 'left' })).result.ok, false);
  assert.deepEqual((await run('open_item', { kind: 'artist', id: 'a9' })).result, { ok: true });
  assert.equal((await run('open_item', { kind: 'artist', id: '' })).result.ok, false);
  assert.deepEqual(app.calls, [
    'screen',
    'press:c1',
    'press:c9',
    'type:c2:психосис:true',
    'type:c1:x:false',
    'scroll:bottom',
    'item:artist:a9',
  ]);
});

test('play_screen plays a track of the screen, can be undone, and says when it is not there', async () => {
  const { app, env, run } = setup();
  const played = await run('play_screen', { n: 2 });
  assert.deepEqual(played.result, { ok: true, started: 'Track 1' });
  assert.equal(played.mark.intent, 'play');
  assert.equal(env.stack.length, 1);
  assert.equal(env.undo, true);
  const missing = await run('play_screen', { n: 7 });
  assert.deepEqual(missing.result, { ok: false, reason: 'not_on_screen' });
  assert.equal(missing.returns, true);
  assert.deepEqual(app.calls, ['row:2', 'row:7']);
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

test('every phrase is offered all the tools and the assistant decides what to do', () => {
  const all = chatTools(fakePort(), fakeApp(), []).map((t) => t.name);
  for (const heard of ['не лайкай', 'включи психосис гот раша', 'привет']) {
    const offered = toolsOf(command('none', { heard }), fakePort(), fakeApp());
    assert.deepEqual(
      offered.map((t) => t.name),
      all,
    );
  }
});
