import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execute, undoTop } from '../src/lib/voice/execute.ts';
import {
  findEntry,
  pushStep,
  stillValid,
  UNDO_TTL_MS,
  type UndoEntry,
} from '../src/lib/voice/undo.ts';
import { ARTIST, act, command, fakePort } from './voice-fake-port.ts';

const NOW = 5_000_000;

test('voice undo restores the last command', async () => {
  const port = fakePort({ volume: 40 });
  const first = await execute(command('volume_set', { number: 80 }), port, {
    lang: 'ru',
    now: NOW,
    stack: [],
  });
  assert.equal(port.state.volume, 80);
  const undo = await execute(command('undo'), port, {
    lang: 'ru',
    now: NOW + 1000,
    stack: first.stack,
  });
  assert.equal(undo.kind, 'done');
  assert.equal(undo.outcome.speech, 'Возвращаю как было');
  assert.equal(port.state.volume, 40);
  assert.equal(undo.stack.length, 0);
});

test('one undo reverts a whole group in reverse order', async () => {
  const port = fakePort({ repeat: 'all', shuffle: false });
  let stack: UndoEntry[] = [];
  const steps = [
    command('repeat_off', { id: 'g1-1', group: 'g1', step: 1, steps: 2 }),
    command('shuffle_on', { id: 'g1-2', group: 'g1', step: 2, steps: 2 }),
  ];
  for (const cmd of steps)
    stack = (await execute(cmd, port, { lang: 'ru', now: NOW, stack })).stack;
  assert.equal(stack.length, 1);
  assert.equal(stack[0].id, 'g1');
  assert.equal(stack[0].steps.length, 2);
  assert.equal(port.state.repeat, 'off');
  assert.equal(port.state.shuffle, true);
  port.calls.length = 0;
  const next = await undoTop(port, { lang: 'ru', now: NOW + 500, stack });
  assert.ok(next);
  assert.deepEqual(port.calls, ['restore:shuffle', 'restore:repeat']);
  assert.equal(port.state.repeat, 'all');
  assert.equal(port.state.shuffle, false);
});

test('undo is refused once the user changed the same thing by hand', async () => {
  const port = fakePort({ volume: 40 });
  const res = await execute(command('volume_set', { number: 50 }), port, {
    lang: 'ru',
    now: NOW,
    stack: [],
  });
  port.state.volume = 70;
  const entry = findEntry(res.stack, res.stack[0].id);
  assert.ok(entry);
  assert.equal(stillValid(entry, NOW + 10, port.shot()), false);
  const undo = await execute(command('undo'), port, {
    lang: 'ru',
    now: NOW + 10,
    stack: res.stack,
  });
  assert.equal(undo.kind, 'failed');
  assert.equal(undo.outcome.speech, 'Нечего отменять');
  assert.equal(port.state.volume, 70);
});

test('play undo stays valid while the started queue plays on', async () => {
  const port = fakePort();
  const res = await execute(command('play', { decision: act(ARTIST) }), port, {
    lang: 'ru',
    now: NOW,
    stack: [],
  });
  const entry = res.stack[0];
  port.state.track = port.state.queue[1];
  port.state.queueIndex = 1;
  assert.equal(stillValid(entry, NOW + 60_000, port.shot()), true);
  port.state.queue = [port.state.queue[1]];
  assert.equal(stillValid(entry, NOW + 60_000, port.shot()), false);
});

test('undo expires after its ttl', async () => {
  const port = fakePort();
  const res = await execute(command('shuffle_on'), port, { lang: 'ru', now: NOW, stack: [] });
  assert.equal(stillValid(res.stack[0], NOW + UNDO_TTL_MS - 1, port.shot()), true);
  assert.equal(stillValid(res.stack[0], NOW + UNDO_TTL_MS + 1, port.shot()), false);
});

test('queue undo holds while the added tracks are still queued', async () => {
  const port = fakePort();
  const res = await execute(command('queue_add', { decision: act(ARTIST) }), port, {
    lang: 'ru',
    now: NOW,
    stack: [],
  });
  assert.equal(stillValid(res.stack[0], NOW, port.shot()), true);
  port.state.queue = port.state.queue.slice(0, 3);
  assert.equal(stillValid(res.stack[0], NOW, port.shot()), false);
});

test('the stack keeps the newest twenty entries', () => {
  const port = fakePort();
  let stack: UndoEntry[] = [];
  for (let i = 0; i < 25; i++) {
    stack = pushStep(
      stack,
      `c${i}`,
      { scope: ['volume'], before: port.shot(), after: port.shot() },
      NOW + i,
    );
  }
  assert.equal(stack.length, 20);
  assert.equal(stack[0].id, 'c5');
  assert.equal(stack[19].id, 'c24');
});
