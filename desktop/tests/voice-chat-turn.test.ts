import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LAST_EVENT_WAIT_MS,
  MAX_ACTIONS,
  MAX_ROUNDS,
  runTurn,
  type TurnInput,
} from '../src/lib/voice/chat/turn.ts';
import type { Ran, ToolMark } from '../src/lib/voice/chat/types';
import { bodyOf, ranOf, type Step, wire } from './voice-chat-fakes.ts';

interface Seen {
  log: string[];
  marks: ToolMark[];
  abort: AbortController;
}

function turn(rounds: Step[][], tools: Record<string, Ran> = {}, extra: Partial<TurnInput> = {}) {
  const seen: Seen = { log: [], marks: [], abort: new AbortController() };
  const link = wire(rounds);
  const input: TurnInput = {
    id: 'turn-1',
    speak: true,
    rounds: MAX_ROUNDS,
    signal: seen.abort.signal,
    body: bodyOf,
    send: link.send,
    act: async (name) => {
      seen.log.push(`act:${name}`);
      return tools[name] ?? ranOf(name, false);
    },
    onSay: (delta) => seen.log.push(`say:${delta}`),
    onMark: (mark) => seen.marks.push(mark),
    ...extra,
  };
  return { seen, link, done: runTurn(input) };
}

test('actions run at once and in order, say deltas accumulate, done ends the round', async () => {
  const { seen, link, done } = turn([
    [
      { kind: 'action', name: 'pause', args: {} },
      { kind: 'action', name: 'volume', args: { mode: 'set', value: 30 } },
      { kind: 'say', text: 'Тише ' },
      { kind: 'say', text: 'стало.' },
      { kind: 'done' },
    ],
  ]);
  const end = await done;
  assert.deepEqual(end, {
    status: 'ok',
    say: 'Тише стало.',
    marks: [
      { tool: 'pause', ok: true },
      { tool: 'volume', ok: true },
    ],
  });
  assert.deepEqual(seen.log, ['act:pause', 'act:volume', 'say:Тише ', 'say:стало.']);
  assert.equal(link.requests.length, 1);
  assert.deepEqual(link.requests[0].body.results, []);
  assert.equal(link.requests[0].id, 'turn-1');
  assert.equal(link.requests[0].speak, true);
});

test('a tool that returns starts another round with the results of the turn', async () => {
  const found = ranOf('search', true, { ok: true, matches: [{ id: 't7' }] });
  const { link, done } = turn(
    [
      [
        { kind: 'action', name: 'search', args: { query: 'x' } },
        { kind: 'say', text: 'Ищу.' },
        { kind: 'done' },
      ],
      [
        { kind: 'action', name: 'play_found', args: {} },
        { kind: 'say', text: 'Включаю.' },
        { kind: 'done' },
      ],
    ],
    { search: found },
  );
  const end = await done;
  assert.equal(end.status, 'ok');
  assert.equal(end.say, 'Ищу. Включаю.');
  assert.equal(link.requests.length, 2);
  assert.deepEqual(link.requests[1].body.results, [
    { name: 'search', args: {}, result: { ok: true, matches: [{ id: 't7' }] } },
  ]);
  assert.deepEqual(
    end.marks.map((m) => m.tool),
    ['search', 'play_found'],
  );
});

test('rounds stop at the limit even when tools keep returning', async () => {
  const again: Step[] = [{ kind: 'action', name: 'search', args: {} }, { kind: 'done' }];
  const { link, done } = turn([again, again, again, again], { search: ranOf('search', true) });
  const end = await done;
  assert.equal(end.status, 'ok');
  assert.equal(link.requests.length, MAX_ROUNDS);
  assert.equal(link.requests[2].body.results.length, 2);
});

test('a round runs a limited number of actions and answers the rest with too_many', async () => {
  const spam: Step[] = Array.from({ length: MAX_ACTIONS + 2 }, (_, i) => ({
    kind: 'action',
    name: i === 0 ? 'search' : 'next',
    args: {},
  }));
  const { seen, link, done } = turn([[...spam, { kind: 'done' }], [{ kind: 'done' }]], {
    search: ranOf('search', true),
  });
  const end = await done;
  assert.equal(end.status, 'ok');
  assert.equal(seen.log.filter((line) => line.startsWith('act:')).length, MAX_ACTIONS);
  assert.equal(end.marks.length, MAX_ACTIONS);
  const results = link.requests[1].body.results;
  assert.equal(results.length, MAX_ACTIONS + 2);
  assert.deepEqual(results.slice(MAX_ACTIONS), [
    { name: 'next', args: {}, result: { ok: false, reason: 'too_many' } },
    { name: 'next', args: {}, result: { ok: false, reason: 'too_many' } },
  ]);
});

test('a cancelled event ends the turn quietly and keeps what was done', async () => {
  const { link, done } = turn([
    [
      { kind: 'action', name: 'pause', args: {} },
      { kind: 'say', text: 'Сей' },
      { kind: 'cancelled' },
    ],
  ]);
  const end = await done;
  assert.equal(end.status, 'cancelled');
  assert.equal(end.say, 'Сей');
  assert.equal(link.requests.length, 1);
});

test('a local abort ends the turn without waiting for the stream', async () => {
  const never = new Promise(() => {});
  const { seen, done } = turn([[{ kind: 'say', text: 'Дол' }, { wait: never }, { kind: 'done' }]]);
  await new Promise((next) => setImmediate(next));
  seen.abort.abort();
  const end = await done;
  assert.equal(end.status, 'cancelled');
  assert.equal(end.say, 'Дол');
});

test('actions queued behind a cancel do not run', async () => {
  let release = () => {};
  const slow = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { seen, done } = turn(
    [
      [
        { kind: 'action', name: 'play', args: {} },
        { kind: 'action', name: 'pause', args: {} },
        { kind: 'cancelled' },
      ],
    ],
    {},
    {
      act: async (name) => {
        seen.log.push(`act:${name}`);
        await slow;
        return ranOf(name, false);
      },
    },
  );
  const end = await done;
  release();
  await slow;
  assert.equal(end.status, 'cancelled');
  assert.deepEqual(end.marks, []);
  assert.deepEqual(seen.log, ['act:play']);
});

test('a cancel that lands while a returning tool runs does not start another round', async () => {
  let release = () => {};
  const slow = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { seen, link, done } = turn(
    [
      [{ kind: 'action', name: 'search', args: {} }, { kind: 'done' }],
      [{ kind: 'say', text: 'Нашла.' }, { kind: 'done' }],
    ],
    {},
    {
      act: async (name) => {
        seen.log.push(`act:${name}`);
        await slow;
        return ranOf(name, true);
      },
    },
  );
  for (let i = 0; i < 5; i++) await new Promise((next) => setImmediate(next));
  seen.abort.abort();
  const end = await done;
  release();
  await slow;
  await new Promise((next) => setImmediate(next));
  assert.deepEqual(end, { status: 'cancelled', say: '', marks: [] });
  assert.equal(link.requests.length, 1);
  assert.deepEqual(seen.marks, []);
});

test('a turn cancelled before it starts sends nothing', async () => {
  const { link, done } = turn([[{ kind: 'done' }]], {}, { signal: AbortSignal.abort() });
  const end = await done;
  assert.deepEqual(end, { status: 'cancelled', say: '', marks: [] });
  assert.equal(link.requests.length, 0);
});

test('a rejected call fails with its code and runs nothing', async () => {
  for (const code of ['rate_limited', 'unavailable', 'star_required', 'network']) {
    const { seen, done } = turn([[{ reject: { code } }]]);
    const end = await done;
    assert.deepEqual(end, { status: 'failed', code, say: '', marks: [] });
    assert.deepEqual(seen.log, []);
  }
});

test('an error event after the stream started fails the turn and keeps what was said', async () => {
  const { seen, done } = turn([
    [
      { kind: 'say', text: 'Ну ' },
      { kind: 'say', text: 'смотри' },
      { kind: 'error', code: 'deadline' },
    ],
  ]);
  assert.deepEqual(await done, { status: 'failed', code: 'deadline', say: 'Ну смотри', marks: [] });
  assert.deepEqual(seen.log, ['say:Ну ', 'say:смотри']);
});

async function settled() {
  for (let i = 0; i < 5; i++) await new Promise((next) => setImmediate(next));
}

test('a call that returns without a final event fails only after the wait', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { done } = turn([[{ kind: 'say', text: 'Ну' }]]);
  let end: Awaited<typeof done> | null = null;
  void done.then((result) => {
    end = result;
  });
  await settled();
  t.mock.timers.tick(LAST_EVENT_WAIT_MS - 1);
  await settled();
  assert.equal(end, null);
  t.mock.timers.tick(1);
  assert.deepEqual(await done, { status: 'failed', code: 'failed', say: 'Ну', marks: [] });
});

test('a final event seconds after the call returned still ends the round well', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { done } = turn(
    [],
    {},
    {
      send: async (_request, onEvent) => {
        onEvent({ kind: 'say', text: 'Готово.' });
        setTimeout(() => onEvent({ kind: 'done' }), 3000);
      },
    },
  );
  await settled();
  t.mock.timers.tick(3000);
  assert.deepEqual(await done, { status: 'ok', say: 'Готово.', marks: [] });
});

test('events after the final one are ignored', async () => {
  const { seen, done } = turn([
    [
      { kind: 'done' },
      { kind: 'say', text: 'поздно' },
      { kind: 'action', name: 'pause', args: {} },
    ],
  ]);
  const end = await done;
  assert.deepEqual(end, { status: 'ok', say: '', marks: [] });
  assert.deepEqual(seen.log, []);
});

test('a failed tool result still goes back when a later round happens', async () => {
  const { link, done } = turn(
    [
      [
        { kind: 'action', name: 'like', args: {} },
        { kind: 'action', name: 'search', args: {} },
        { kind: 'done' },
      ],
      [{ kind: 'say', text: 'Ничего не играет.' }, { kind: 'done' }],
    ],
    {
      like: ranOf('like', false, { ok: false, reason: 'nothing_playing' }),
      search: ranOf('search', true),
    },
  );
  const end = await done;
  assert.equal(end.status, 'ok');
  assert.deepEqual(
    link.requests[1].body.results.map((r) => [r.name, r.result.ok]),
    [
      ['like', false],
      ['search', true],
    ],
  );
  assert.deepEqual(
    end.marks.map((m) => m.ok),
    [false, true],
  );
});
