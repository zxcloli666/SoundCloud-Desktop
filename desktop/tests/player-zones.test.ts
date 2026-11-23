import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  arrange,
  defaultPlacement,
  defaultZone,
  isDefaultPlacement,
  PLAYER_IDS,
  placeButton,
  placeZones,
  zoneIds,
} from '../src/lib/player-zones.ts';

test('default zones put track buttons left, shuffle before, repeat after, the rest right', () => {
  const bar = zoneIds(defaultPlacement('player'), true);
  assert.deepEqual(bar.left, ['like', 'dislike', 'addToPlaylist', 'album', 'block', 'quality']);
  assert.deepEqual(bar.before, ['shuffle']);
  assert.deepEqual(bar.after, ['repeat', 'abLoop']);
  assert.deepEqual(bar.title, []);
  assert.ok(bar.right.includes('queue'));
  assert.equal(defaultZone('deck', 'queue'), 'title');
  assert.equal(defaultZone('player', 'queue'), 'right');
  assert.equal(defaultPlacement('deck').length, PLAYER_IDS.length);
});

test('entries without a zone or with a zone the surface lacks fall back to the default', () => {
  const placed = placeZones('player', [
    { id: 'queue', hidden: false, zone: 'title' },
    { id: 'like', hidden: false },
    { id: 'repeat', hidden: false, zone: 'before' },
  ]);
  assert.deepEqual(
    placed.map((e) => `${e.id}:${e.zone}`),
    ['like:left', 'repeat:before', 'queue:right'],
  );
});

test('placing a button sets its zone and order and keeps the rest', () => {
  const start = defaultPlacement('player');
  const moved = placeButton(start, 'player', 'like', 'after', 'repeat');
  const ids = zoneIds(moved);
  assert.deepEqual(ids.after, ['like', 'repeat']);
  assert.deepEqual(ids.left, []);
  assert.equal(moved.length, start.length);
  assert.deepEqual(placeButton(start, 'player', 'like', 'title', null), start);
  assert.ok(isDefaultPlacement(start, 'player'));
  assert.ok(!isDefaultPlacement(moved, 'player'));
});

test('arrange moves by 1-based position among shown peers and reports where it landed', () => {
  const start = defaultPlacement('deck');
  const first = arrange(start, 'deck', 'lyrics', 'move', 'right', 1);
  assert.equal(first.state, 'ok');
  if (first.state !== 'ok') return;
  assert.equal(first.position, 1);
  assert.equal(zoneIds(first.entries).right[0], 'lyrics');
  const far = arrange(start, 'deck', 'eq', 'show', 'title', 99);
  assert.equal(far.state, 'ok');
  if (far.state !== 'ok') return;
  assert.deepEqual(zoneIds(far.entries).title, ['queue', 'eq']);
  assert.equal(far.position, 2);
  const hidden = arrange(start, 'deck', 'like', 'hide', null, null);
  assert.equal(hidden.state === 'ok' && hidden.hidden, true);
  assert.deepEqual(arrange(start, 'deck', 'play', 'hide', null, null), { state: 'no_button' });
  assert.deepEqual(arrange(start, 'deck', 'like', 'move', null, null), { state: 'no_zone' });
  assert.deepEqual(arrange(start, 'player', 'like', 'move', 'title', null), {
    state: 'bad_zone',
  });
});
