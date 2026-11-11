import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chatAhead, startsAhead } from '../src/lib/voice/chat/early.ts';
import { CHAT_REST_MS, withRest } from '../src/lib/voice/chat/rest.ts';
import { MAX_ROUNDS, runTurn } from '../src/lib/voice/chat/turn.ts';
import type { ChatEvent, ChatRequest, Ran, ToolMark } from '../src/lib/voice/chat/types';
import { bodyOf, ranOf, type Step, wire } from './voice-chat-fakes.ts';

const START = 1_000_000;

function request(id: string): ChatRequest {
  return { id, speak: true, body: bodyOf([]) };
}

async function settled() {
  for (let i = 0; i < 5; i++) await new Promise((next) => setImmediate(next));
}

function gate() {
  let open = () => {};
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open };
}

function line(rounds: Step[][], tools: Record<string, Ran> = {}) {
  const link = wire(rounds);
  const cancelled: string[] = [];
  const clock = { at: START };
  const early = chatAhead(link.send, (id) => cancelled.push(id));
  const send = withRest(early.send, () => clock.at);
  const log: string[] = [];
  const marks: ToolMark[] = [];
  const turn = (id: string) =>
    runTurn({
      id,
      speak: true,
      rounds: MAX_ROUNDS,
      signal: new AbortController().signal,
      body: bodyOf,
      send,
      act: async (name) => {
        log.push(`act:${name}`);
        return tools[name] ?? ranOf(name, false);
      },
      onSay: (delta) => log.push(`say:${delta}`),
      onMark: (mark) => marks.push(mark),
    });
  return { link, cancelled, clock, early, send, log, marks, turn };
}

test('a chat started ahead holds what it gets until the turn takes it, then goes on live', async () => {
  const rest = gate();
  const { link, cancelled, early, log, turn } = line([
    [
      { kind: 'action', name: 'pause', args: {} },
      { kind: 'say', text: 'При' },
      { wait: rest.wait },
      { kind: 'say', text: 'вет!' },
      { kind: 'done' },
    ],
  ]);
  early.start(request('turn-1'));
  await settled();
  assert.equal(link.requests.length, 1);
  assert.deepEqual(log, []);

  const done = turn('turn-1');
  await settled();
  assert.deepEqual(log, ['act:pause', 'say:При']);
  rest.open();
  assert.deepEqual(await done, {
    status: 'ok',
    say: 'Привет!',
    marks: [{ tool: 'pause', ok: true }],
  });
  assert.deepEqual(log, ['act:pause', 'say:При', 'say:вет!']);
  assert.equal(link.requests.length, 1);
  assert.deepEqual(cancelled, []);
});

test('a chat started ahead that already ended is played back whole', async () => {
  const { link, early, turn } = line([[{ kind: 'say', text: 'Привет!' }, { kind: 'done' }]]);
  early.start(request('turn-1'));
  await settled();
  assert.deepEqual(await turn('turn-1'), { status: 'ok', say: 'Привет!', marks: [] });
  assert.equal(link.requests.length, 1);
});

test('the rounds after a tool result are asked as usual', async () => {
  const found = ranOf('search', true, { ok: true, matches: [] });
  const { link, early, turn } = line(
    [
      [{ kind: 'action', name: 'search', args: {} }, { kind: 'done' }],
      [{ kind: 'say', text: 'Ничего.' }, { kind: 'done' }],
    ],
    { search: found },
  );
  early.start(request('turn-1'));
  await settled();
  const end = await turn('turn-1');
  assert.equal(end.status, 'ok');
  assert.equal(end.say, 'Ничего.');
  assert.equal(link.requests.length, 2);
  assert.equal(link.requests[1].body.results.length, 1);
});

test('a chat started ahead for a phrase that is not talk is cancelled and leaves nothing', async () => {
  const rest = gate();
  const { link, cancelled, early, log, marks, turn } = line([
    [
      { kind: 'action', name: 'pause', args: {} },
      { kind: 'say', text: 'При' },
      { wait: rest.wait },
      { kind: 'say', text: 'вет!' },
      { kind: 'done' },
    ],
    [{ kind: 'say', text: 'Заново.' }, { kind: 'done' }],
  ]);
  early.start(request('turn-1'));
  await settled();
  early.keepOnly('turn-2');
  assert.deepEqual(cancelled, ['turn-1']);
  rest.open();
  await settled();
  assert.deepEqual(log, []);
  assert.deepEqual(marks, []);

  early.keepOnly('turn-2');
  early.drop('turn-1');
  assert.deepEqual(cancelled, ['turn-1']);
  assert.deepEqual(await turn('turn-1'), { status: 'ok', say: 'Заново.', marks: [] });
  assert.equal(link.requests.length, 2);
});

test('the phrase the chat was started for keeps it, and gives it up when it did not talk', async () => {
  const { cancelled, early } = line([[{ kind: 'say', text: 'Привет!' }, { kind: 'done' }]]);
  early.start(request('turn-1'));
  early.keepOnly('turn-1');
  early.drop('turn-2');
  assert.deepEqual(cancelled, []);
  early.drop('turn-1');
  assert.deepEqual(cancelled, ['turn-1']);
});

test('a new phrase cancels the chat started ahead of the one before', async () => {
  const { link, cancelled, early, turn } = line([
    [{ kind: 'say', text: 'Первый.' }, { kind: 'done' }],
    [{ kind: 'say', text: 'Второй.' }, { kind: 'done' }],
  ]);
  early.start(request('turn-1'));
  early.start(request('turn-2'));
  assert.deepEqual(cancelled, ['turn-1']);
  assert.deepEqual(await turn('turn-2'), { status: 'ok', say: 'Второй.', marks: [] });
  assert.equal(link.requests.length, 2);
});

test('a refusal of a chat that was dropped does not rest the chat', async () => {
  const { link, early, send, turn } = line([
    [{ reject: { code: 'network' } }],
    [{ kind: 'say', text: 'Привет!' }, { kind: 'done' }],
  ]);
  early.start(request('turn-1'));
  await settled();
  early.keepOnly('turn-2');
  assert.equal(send.resting(), false);
  assert.deepEqual(await turn('turn-2'), { status: 'ok', say: 'Привет!', marks: [] });
  assert.equal(link.requests.length, 2);
});

test('a refusal of a chat the turn took fails the turn and rests the chat', async () => {
  const { link, clock, early, send, turn } = line([[{ reject: { code: 'unavailable' } }]]);
  early.start(request('turn-1'));
  await settled();
  assert.equal(send.resting(), false);
  assert.deepEqual(await turn('turn-1'), {
    status: 'failed',
    code: 'unavailable',
    say: '',
    marks: [],
  });
  assert.equal(send.resting(), true);
  const next = await turn('turn-2');
  assert.equal(next.status, 'failed');
  assert.equal(link.requests.length, 1);
  clock.at += CHAT_REST_MS;
  assert.equal(send.resting(), false);
});

test('events of a chat that was dropped reach nobody', async () => {
  const events: ChatEvent[] = [];
  const sent: ((event: ChatEvent) => void)[] = [];
  const early = chatAhead(
    (_request, onEvent) => {
      sent.push(onEvent);
      return new Promise(() => {});
    },
    () => {},
  );
  early.start(request('turn-1'));
  early.keepOnly('turn-2');
  sent[0]({ kind: 'say', text: 'поздно' });
  void early.send(request('turn-1'), (event) => events.push(event));
  sent[0]({ kind: 'say', text: 'ещё позже' });
  assert.equal(sent.length, 2);
  assert.deepEqual(events, []);
});

test('a chat starts ahead only for a phrase the chat may answer now', () => {
  const heard = { id: 'turn-1', source: 'button' as const, heard: 'как дела' };
  const ready = { on: true, resting: false };
  assert.equal(startsAhead(heard, ready), true);
  assert.equal(startsAhead({ ...heard, source: 'typed' }, ready), true);
  assert.equal(startsAhead(heard, { on: false, resting: false }), false);
  assert.equal(startsAhead(heard, { on: true, resting: true }), false);
  assert.equal(startsAhead({ ...heard, source: 'remote' }, ready), false);
  assert.equal(startsAhead({ ...heard, heard: '  ' }, ready), false);
});
