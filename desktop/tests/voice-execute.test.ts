import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ChatStep } from '../src/lib/voice/chat/step';
import type { TurnEnd } from '../src/lib/voice/chat/types';
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

test('an ask with one option asks about that one', async () => {
  const port = fakePort();
  const decision = {
    decision: 'ask' as const,
    first: { entity: ARTIST, score: 0.7 },
    second: null,
  };
  const res = await execute(command('play', { decision }), port, ctx());
  assert.equal(res.kind, 'ask');
  assert.deepEqual(port.calls, []);
  assert.equal(res.outcome.speech, 'Включить Скриптонит?');
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

function chatting(end: TurnEnd, undo = false) {
  const asked: string[] = [];
  const chat = async (cmd: { heard: string }): Promise<ChatStep> => {
    asked.push(cmd.heard);
    return { end, stack: [], undo };
  };
  return { asked, chat };
}

test('no intent goes to the chat when it is on and returns the reply as display only', async () => {
  const { asked, chat } = chatting({ status: 'ok', say: 'Привет!', marks: [] }, true);
  const res = await execute(command('none', { heard: 'как дела' }), fakePort(), {
    ...ctx(),
    chat,
  });
  assert.deepEqual(asked, ['как дела']);
  assert.equal(res.kind, 'chat');
  assert.deepEqual(res.outcome, { ok: true, speech: '', display: 'Привет!', undo: true });
  assert.equal(res.chat?.status, 'ok');
});

test('no intent stays ignored without the chat, for empty text and for smart speakers', async () => {
  const { asked, chat } = chatting({ status: 'ok', say: 'Привет!', marks: [] });
  const off = await execute(command('none', { heard: 'как дела' }), fakePort(), ctx());
  assert.equal(off.kind, 'ignored');
  const empty = await execute(command('none', { heard: '  ' }), fakePort(), { ...ctx(), chat });
  assert.equal(empty.kind, 'ignored');
  const remote = command('none', { heard: 'как дела', source: 'remote' });
  assert.equal((await execute(remote, fakePort(), { ...ctx(), chat })).kind, 'ignored');
  assert.deepEqual(asked, []);
});

test('commands with an intent never reach the chat', async () => {
  const { asked, chat } = chatting({ status: 'ok', say: 'Привет!', marks: [] });
  const res = await execute(command('pause'), fakePort(), { ...ctx(), chat });
  assert.equal(res.kind, 'done');
  assert.deepEqual(asked, []);
});

test('chat failures speak nothing and carry their code for the interface to word', async () => {
  for (const code of ['rate_limited', 'unavailable', 'deadline', 'network']) {
    const end: TurnEnd = { status: 'failed', code, say: 'Ну', marks: [] };
    const { chat } = chatting(end);
    const res = await execute(command('none'), fakePort(), { ...ctx(), chat });
    assert.equal(res.kind, 'failed');
    assert.deepEqual(res.outcome, { ok: false, speech: '', display: '', undo: false });
    assert.deepEqual(res.chat, end);
  }
});

test('help goes to the chat when it is on and the reply is the answer', async () => {
  const { asked, chat } = chatting({ status: 'ok', say: 'Умею вот что.', marks: [] });
  const cmd = command('help', { heard: 'что умеешь' });
  const res = await execute(cmd, fakePort(), { ...ctx(), chat });
  assert.deepEqual(asked, ['что умеешь']);
  assert.equal(res.kind, 'chat');
  assert.deepEqual(res.outcome, { ok: true, speech: '', display: 'Умею вот что.', undo: false });
});

test('help keeps the fixed reply when the chat is off, fails or says nothing', async () => {
  const cmd = command('help', { heard: 'что умеешь' });
  const fixed = await execute(cmd, fakePort(), ctx());
  assert.equal(fixed.kind, 'done');
  assert.match(fixed.outcome.speech, /пауза.*громкость/);
  const ends: TurnEnd[] = [
    { status: 'failed', code: 'unavailable', say: 'Ну', marks: [] },
    { status: 'failed', code: 'rate_limited', say: '', marks: [] },
    { status: 'ok', say: ' ', marks: [] },
  ];
  for (const end of ends) {
    const { asked, chat } = chatting(end);
    const res = await execute(cmd, fakePort(), { ...ctx(), chat });
    assert.deepEqual(asked, ['что умеешь']);
    assert.equal(res.kind, 'done');
    assert.deepEqual(res.outcome, fixed.outcome);
    assert.equal(res.chat, undefined);
  }
  const remote = chatting({ status: 'ok', say: 'Умею вот что.', marks: [] });
  const speaker = command('help', { heard: 'что умеешь', source: 'remote' });
  const res = await execute(speaker, fakePort(), { ...ctx(), chat: remote.chat });
  assert.deepEqual(res.outcome, fixed.outcome);
  assert.deepEqual(remote.asked, []);
});

test('help cancelled in the chat stays quiet, the fixed reply is not spoken after it', async () => {
  const { chat } = chatting({ status: 'cancelled', say: 'Умею', marks: [] });
  const res = await execute(command('help', { heard: 'помощь' }), fakePort(), { ...ctx(), chat });
  assert.equal(res.kind, 'cancelled');
  assert.equal(res.outcome.speech, '');
});

test('a cancelled chat is quiet and an empty reply is ignored', async () => {
  const cancelled = chatting({ status: 'cancelled', say: 'Сей', marks: [] });
  const res = await execute(command('none'), fakePort(), { ...ctx(), chat: cancelled.chat });
  assert.equal(res.kind, 'cancelled');
  assert.deepEqual(res.outcome, { ok: false, speech: '', display: '', undo: false });
  const silent = chatting({ status: 'ok', say: ' ', marks: [] });
  const empty = await execute(command('none'), fakePort(), { ...ctx(), chat: silent.chat });
  assert.equal(empty.kind, 'ignored');
  const acted = chatting({ status: 'ok', say: '', marks: [{ tool: 'pause', ok: true }] });
  const done = await execute(command('none'), fakePort(), { ...ctx(), chat: acted.chat });
  assert.equal(done.kind, 'chat');
});
