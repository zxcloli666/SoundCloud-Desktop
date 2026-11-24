import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitsOneRow } from '../src/lib/player-row.ts';
import { defaultPlacement, PLAYER_IDS, placeButton, zoneIds } from '../src/lib/player-zones.ts';

const byDefault = defaultPlacement('player');
const everything = byDefault.map((entry) => ({ ...entry, hidden: false }));
const withReactions = byDefault.map((entry) => ({
  ...entry,
  hidden: entry.hidden && !['dislike', 'addToPlaylist', 'quality'].includes(entry.id),
}));

test('the default buttons stay in one row in the smallest window', () => {
  for (const width of [640, 680, 800, 1020, 1128]) {
    assert.equal(fitsOneRow(zoneIds(byDefault), width), true, `${width}`);
  }
});

test('extra track buttons get a second row only when they do not fit', () => {
  assert.equal(fitsOneRow(zoneIds(withReactions), 1020), true);
  assert.equal(fitsOneRow(zoneIds(withReactions), 800), false);
});

test('a button moved over play frees the room of the title', () => {
  const moved = placeButton(withReactions, 'player', 'quality', 'after', null);
  assert.equal(fitsOneRow(zoneIds(withReactions), 800), false);
  assert.equal(fitsOneRow(zoneIds(moved), 800), true);
});

test('the whole set of buttons never squeezes the title out', () => {
  assert.equal(fitsOneRow(zoneIds(everything), 1128), true);
  assert.equal(fitsOneRow(zoneIds(everything), 1020), false);
});

test('buttons around play count for both sides of it', () => {
  const moved = PLAYER_IDS.slice(0, 6).reduce(
    (entries, id) => placeButton(entries, 'player', id, 'before', null),
    everything.map((entry) => ({ ...entry, hidden: entry.zone === 'right' })),
  );
  assert.equal(fitsOneRow(zoneIds(moved), 900), false);
});
