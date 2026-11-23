import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildQueueItems,
  groupAfterMove,
  type QueueGroup,
  queueIds,
} from '../src/components/music/queue/queue-items.ts';

const shape = (groups: QueueGroup[], queueIndex: number, playedOpen = false) => ({
  ids: queueIds(groups.map((_, i) => `t${i}`)),
  groups,
  queueIndex,
  playedOpen,
  autoplayFooter: true,
});

const kinds = (items: ReturnType<typeof buildQueueItems>) =>
  items.map((item) =>
    item.kind === 'section' ? `${item.group}:${item.count}${item.autoplay ? '*' : ''}` : item.kind,
  );

test('duplicate urns get distinct ids', () => {
  assert.deepEqual(queueIds(['a', 'b', 'a', 'a']), ['a#0', 'b#0', 'a#1', 'a#2']);
});

test('upcoming tracks split into runs by origin, autoplay last', () => {
  const groups: QueueGroup[] = ['context', 'context', 'added', 'added', 'context', 'auto', 'auto'];
  const items = buildQueueItems(shape(groups, 1));
  assert.deepEqual(kinds(items), [
    'played',
    'added:2',
    'track',
    'track',
    'context:1',
    'track',
    'auto:2*',
    'track',
    'track',
  ]);
});

test('played group expands with the playing row as anchor', () => {
  const items = buildQueueItems(shape(['context', 'context', 'context', 'context'], 2, true));
  const tones = items.filter((item) => item.kind === 'track').map((item) => item.tone);
  assert.deepEqual(tones, ['played', 'played', 'now', 'next']);
});

test('no autoplay run gives an autoplay footer with a hint', () => {
  const items = buildQueueItems(shape(['context', 'context'], 0));
  assert.deepEqual(kinds(items), ['context:1', 'track', 'auto:0*', 'hint']);
});

test('500 tracks build in one pass with stable keys', () => {
  const groups = Array.from({ length: 500 }, (_, i): QueueGroup => (i < 480 ? 'context' : 'auto'));
  const items = buildQueueItems(shape(groups, 40, true));
  assert.equal(items.filter((item) => item.kind === 'track').length, 500);
  assert.equal(new Set(items.map((item) => item.key)).size, items.length);
});

test('a dropped track joins the section of the row it lands on', () => {
  const groups: QueueGroup[] = ['context', 'added', 'context', 'context', 'auto', 'auto'];
  assert.equal(groupAfterMove(groups, 5, 2), 'context');
  assert.equal(groupAfterMove(groups, 2, 3), null);
  assert.equal(groupAfterMove(groups, 4, 1), 'added');
  assert.equal(groupAfterMove(groups, 1, 4), 'auto');
});
