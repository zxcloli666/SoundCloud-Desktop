import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execute } from '../src/lib/voice/execute.ts';
import type { UndoEntry } from '../src/lib/voice/undo';
import { ARTIST, act, command, fakePort } from './voice-fake-port.ts';

const NOW = 1_000_000;

function ctx(stack: UndoEntry[] = [], lang: 'ru' | 'en' = 'ru') {
  return { lang, now: NOW, stack };
}

test('plays an artist through the port and replies in Russian', async () => {
  const port = fakePort();
  const res = await execute(command('play', { decision: act(ARTIST) }), port, ctx());
  assert.equal(res.kind, 'done');
  assert.deepEqual(port.calls, ['play:artist:a1']);
  assert.equal(res.outcome.speech, 'Включаю Скриптонит');
  assert.equal(res.outcome.display, 'Скриптонит');
  assert.equal(res.outcome.undo, true);
  assert.equal(res.stack.length, 1);
});

test('english replies follow the voice language', async () => {
  const port = fakePort();
  const res = await execute(command('volume_set', { number: 50 }), port, ctx([], 'en'));
  assert.equal(res.outcome.speech, 'Volume 50');
});

test('ask decisions do not touch the player', async () => {
  const port = fakePort();
  const second = { ...ARTIST, name: 'Мот', id: 'a2' };
  const decision = {
    decision: 'ask' as const,
    first: { entity: ARTIST, score: 0.8 },
    second: { entity: second, score: 0.79 },
  };
  const res = await execute(command('play', { decision }), port, ctx());
  assert.equal(res.kind, 'ask');
  assert.deepEqual(port.calls, []);
  assert.match(res.outcome.speech, /Скриптонит.*Мот/);
});

test('play without a match is not found and keeps what was heard', async () => {
  const port = fakePort();
  const res = await execute(command('play', { heard: 'включи кого-то' }), port, ctx());
  assert.equal(res.kind, 'not_found');
  assert.equal(res.outcome.ok, false);
  assert.equal(res.outcome.display, 'включи кого-то');
});

test('volume steps use the number as step size and clamp', async () => {
  const up = fakePort({ volume: 40 });
  await execute(command('volume_up', { number: 5 }), up, ctx());
  assert.equal(up.state.volume, 45);
  const down = fakePort({ volume: 4 });
  await execute(command('volume_down'), down, ctx());
  assert.equal(down.state.volume, 0);
  const set = fakePort();
  const res = await execute(command('volume_set', { number: 50 }), set, ctx());
  assert.equal(res.outcome.speech, 'Громкость 50');
});

test('seek forward defaults to ten seconds', async () => {
  const port = fakePort({ position: 30 });
  const res = await execute(command('seek_forward'), port, ctx());
  assert.deepEqual(port.calls, ['seek:40']);
  assert.equal(res.outcome.speech, 'Вперёд на 10 секунд');
  await execute(command('seek_backward', { number: 1 }), port, ctx());
  assert.equal(port.state.position, 39);
});

test('commands that need a track fail politely without one', async () => {
  const port = fakePort({ track: null, queue: [] });
  const res = await execute(command('like'), port, ctx());
  assert.equal(res.kind, 'failed');
  assert.equal(res.outcome.speech, 'Сейчас ничего не играет');
  assert.deepEqual(port.calls, []);
});

test('now playing reads the current track and has no undo', async () => {
  const port = fakePort();
  const res = await execute(command('now_playing'), port, ctx());
  assert.equal(res.outcome.speech, 'Сейчас играет Скриптонит — Track 1');
  assert.equal(res.outcome.undo, false);
  assert.equal(res.stack.length, 0);
});

test('help lists what to say, none is ignored', async () => {
  const port = fakePort();
  const help = await execute(command('help'), port, ctx());
  assert.match(help.outcome.speech, /пауза.*громкость/);
  const none = await execute(command('none'), port, ctx());
  assert.equal(none.kind, 'ignored');
  assert.equal(none.outcome.speech, '');
});

test('like and queue add go through the port', async () => {
  const port = fakePort();
  await execute(command('like'), port, ctx());
  assert.equal(port.state.liked, true);
  const res = await execute(command('queue_add', { decision: act(ARTIST) }), port, ctx());
  assert.equal(res.outcome.speech, 'Добавлено в очередь: Скриптонит');
});

test('a port failure turns into a failed outcome', async () => {
  const port = fakePort();
  port.playWave = async () => {
    throw new Error('offline');
  };
  const res = await execute(command('play_wave'), port, ctx());
  assert.equal(res.kind, 'failed');
  assert.equal(res.outcome.speech, 'Не получилось');
});
