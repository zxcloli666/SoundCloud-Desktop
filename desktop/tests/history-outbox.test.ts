import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  afterListenedSent,
  afterPlaySent,
  nextFor,
  OUTBOX_LIMIT,
  type OutboxItem,
  ownedBy,
  type QueuedPlay,
  withListened,
  without,
  withPlay,
} from '../src/lib/history-outbox.ts';

function play(id: string, user: string | null = 'u1', playedAt = 1): QueuedPlay {
  const body = {
    scTrackId: `soundcloud:tracks:${id}`,
    title: id,
    artistName: 'a',
    artistUrn: null,
    artworkUrl: null,
    duration: 1000,
  };
  return { kind: 'play', id: `local:${id}`, user, playedAt, body, ms: 0 };
}

test('plays keep their order and the oldest fall out past the limit', () => {
  let items: OutboxItem[] = [];
  for (let i = 0; i < OUTBOX_LIMIT + 3; i++) items = withPlay(items, play(String(i)));
  assert.equal(items.length, OUTBOX_LIMIT);
  assert.equal(items[0].id, 'local:3');
  assert.equal(items.at(-1)?.id, `local:${OUTBOX_LIMIT + 2}`);
});

test('listened time on a queued play stays on that play and only grows', () => {
  let items: OutboxItem[] = [play('a')];
  items = withListened(items, 'local:a', 'u1', 5000);
  items = withListened(items, 'local:a', 'u1', 3000);
  assert.deepEqual(
    items.map((item) => [item.kind, item.id, item.ms]),
    [['play', 'local:a', 5000]],
  );
});

test('listened time for a sent play is one item per entry', () => {
  let items: OutboxItem[] = [];
  items = withListened(items, 'srv-1', 'u1', 1000);
  items = withListened(items, 'srv-1', 'u1', 4000);
  assert.deepEqual(
    items.map((item) => [item.kind, item.id, item.ms]),
    [['listened', 'srv-1', 4000]],
  );
});

test('a local id that left the queue is not sent as listened', () => {
  assert.deepEqual(withListened([], 'local:gone', 'u1', 1000), []);
});

test('a sent play turns into its listened report in place', () => {
  const items = withListened([play('a'), play('b')], 'local:a', 'u1', 7000);
  assert.deepEqual(
    afterPlaySent(items, 'local:a', 'srv-a').map((item) => [item.kind, item.id, item.ms]),
    [
      ['listened', 'srv-a', 7000],
      ['play', 'local:b', 0],
    ],
  );
  assert.deepEqual(
    afterPlaySent([play('a')], 'local:a', 'srv-a').map((item) => item.id),
    [],
  );
  assert.deepEqual(
    afterPlaySent(items, 'local:a', null).map((item) => item.id),
    ['local:b'],
  );
});

test('listened stays queued when it grew while the report was out', () => {
  const items = withListened([], 'srv-1', 'u1', 9000);
  assert.equal(afterListenedSent(items, 'srv-1', 4000).length, 1);
  assert.equal(afterListenedSent(items, 'srv-1', 9000).length, 0);
});

test('items go to their own user, unowned ones to whoever is signed in', () => {
  const items = [play('a', 'u2'), play('b', null), play('c', 'u1')];
  assert.equal(nextFor(items, 'u1')?.id, 'local:b');
  assert.equal(nextFor(items, 'u2')?.id, 'local:a');
  assert.deepEqual(
    ownedBy(items).map((item) => item.id),
    ['local:a', 'local:c'],
  );
  assert.deepEqual(
    without(items, items[1]).map((item) => item.id),
    ['local:a', 'local:c'],
  );
});
