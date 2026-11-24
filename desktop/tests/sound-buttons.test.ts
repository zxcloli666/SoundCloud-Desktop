import assert from 'node:assert/strict';
import { test } from 'node:test';
import { soundFromButtons } from '../src/lib/legacy/sound-buttons.ts';
import { placeZones, type Surface, zoneIds } from '../src/lib/player-zones.ts';

type Saved = Parameters<typeof soundFromButtons>[0]['player'];

const REMOVED = ['tuning', 'eq', 'effects', 'sleep', 'abLoop'];

function migrated(surface: Surface, saved: Saved): Saved {
  return soundFromButtons({
    sidebar: [{ id: 'home', hidden: true }],
    quick: [],
    library: [],
    home: [],
    stations: [],
    player: [],
    deck: [],
    [surface]: saved,
  })[surface];
}

for (const surface of ['player', 'deck'] as const) {
  test(`${surface}: a visible removed button shows the hidden sound button where it stood`, () => {
    for (const id of REMOVED) {
      const saved = [
        { id: 'sound', hidden: true, zone: 'left' as const },
        { id, hidden: false, zone: 'right' as const },
      ];
      assert.deepEqual(migrated(surface, saved), [{ id: 'sound', hidden: false, zone: 'left' }]);
    }
  });

  test(`${surface}: without a saved sound button it takes the place of the first visible one`, () => {
    const after = migrated(surface, [
      { id: 'like', hidden: false, zone: 'left' },
      { id: 'effects', hidden: true, zone: 'left' },
      { id: 'eq', hidden: false, zone: 'before' },
      { id: 'shuffle', hidden: false, zone: 'before' },
      { id: 'tuning', hidden: false, zone: 'after' },
    ]);
    assert.deepEqual(after, [
      { id: 'like', hidden: false, zone: 'left' },
      { id: 'sound', hidden: false, zone: 'before' },
      { id: 'shuffle', hidden: false, zone: 'before' },
    ]);
  });

  test(`${surface}: hidden removed buttons go away and sound stays as it was`, () => {
    const gone = REMOVED.map((id) => ({ id, hidden: true, zone: 'right' as const }));
    for (const hidden of [true, false]) {
      const sound = { id: 'sound', hidden, zone: 'right' as const };
      assert.deepEqual(migrated(surface, [...gone, sound]), [sound]);
    }
    assert.deepEqual(migrated(surface, gone), []);
  });

  test(`${surface}: the sound button is shown once and no removed id is left`, () => {
    const saved = [...REMOVED, 'queue', 'sound', 'like'].map((id) => ({ id, hidden: false }));
    assert.deepEqual(
      migrated(surface, saved).map((e) => e.id),
      ['queue', 'sound', 'like'],
    );
  });

  test(`${surface}: an untouched layout stays empty`, () => {
    assert.deepEqual(migrated(surface, []), []);
  });
}

test('a button saved without a zone gives sound the zone it stood in by default', () => {
  const zones = (id: string) =>
    zoneIds(placeZones('player', migrated('player', [{ id, hidden: false }])));
  assert.ok(zones('eq').right.includes('sound'));
  assert.ok(zones('abLoop').after.includes('sound'));
});

test('other layouts are kept', () => {
  const layouts = {
    sidebar: [{ id: 'home', hidden: true }],
    quick: [{ id: 'likes', hidden: false }],
    library: [],
    home: [{ id: 'river', hidden: true }],
    stations: [],
    player: [],
    deck: [],
  };
  assert.deepEqual(soundFromButtons(layouts), layouts);
});
