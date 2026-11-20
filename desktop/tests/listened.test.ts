import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createListenedMeter } from '../src/lib/listened.ts';

function meter() {
  const sent: Array<[string, number]> = [];
  const m = createListenedMeter((id, ms) => sent.push([id, ms]));
  return { m, sent };
}

function play(
  m: ReturnType<typeof meter>['m'],
  fromSec: number,
  seconds: number,
  rate = 1,
  at = 0,
) {
  for (let i = 1; i <= seconds * 10; i++) {
    m.tick(fromSec + (i * rate) / 10, at + i * 100, rate, true);
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('only playing time is counted and the total goes out once on flush', async () => {
  const { m, sent } = meter();
  m.begin(Promise.resolve('h1'));
  m.tick(0, 0, 1, true);
  play(m, 0, 5);
  m.flush();
  await settle();
  assert.deepEqual(sent, [['h1', 5000]]);
});

test('a seek jump and a paused stretch add nothing', async () => {
  const { m, sent } = meter();
  m.begin(Promise.resolve('h1'));
  play(m, 0, 3);
  m.tick(120, 3100, 1, true);
  play(m, 120, 2, 1, 3100);
  m.tick(122.1, 60_000, 1, true);
  m.tick(122.2, 60_100, 1, false);
  m.flush();
  await settle();
  assert.deepEqual(sent, [['h1', 5000]]);
});

test('a faster rate does not inflate the time', async () => {
  const { m, sent } = meter();
  m.begin(Promise.resolve('h1'));
  play(m, 0, 4, 2);
  m.flush();
  await settle();
  assert.deepEqual(sent, [['h1', 4000]]);
});

test('a snapshot then a flush send growing totals and nothing twice', async () => {
  const { m, sent } = meter();
  m.begin(Promise.resolve('h1'));
  play(m, 0, 2);
  m.snapshot();
  m.snapshot();
  play(m, 2, 2, 1, 2000);
  m.flush();
  await settle();
  assert.deepEqual(sent, [
    ['h1', 2000],
    ['h1', 4000],
  ]);
});

test('a reload that gets the same history id keeps counting from the old total', async () => {
  const { m, sent } = meter();
  m.begin(Promise.resolve('h1'));
  play(m, 0, 3);
  m.begin(Promise.resolve('h1'));
  await settle();
  play(m, 0, 2);
  m.flush();
  await settle();
  assert.equal(sent.at(-1)?.[0], 'h1');
  assert.equal(sent.at(-1)?.[1], 4900);
});

test('an entry without a history id sends nothing', async () => {
  const { m, sent } = meter();
  m.begin(Promise.resolve(null));
  play(m, 0, 3);
  m.flush();
  await settle();
  assert.deepEqual(sent, []);
});
