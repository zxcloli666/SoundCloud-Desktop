import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutsFromRiver } from '../src/lib/legacy/river.ts';

type Layouts = Parameters<typeof layoutsFromRiver>[1];
type Entry = Layouts['home'][number];

const EMPTY: Layouts = {
  sidebar: [],
  quick: [],
  library: [],
  home: [],
  stations: [],
  player: [],
  deck: [],
};
const ALL_HIDDEN = [
  'wave',
  'moments',
  'top_artists',
  'fresh_drops',
  'same_vibe',
  'adjacent',
  'deep_cuts',
  'discover',
];

const shown = (entries: Entry[]) => entries.filter((e) => !e.hidden).map((e) => e.id);

test('an untouched river leaves stations at their defaults', () => {
  assert.deepEqual(layoutsFromRiver([], EMPTY), EMPTY);
});

test('sections turned on after the redesign stay on next to the new defaults', () => {
  const saved = [...ALL_HIDDEN.filter((id) => id !== 'top_artists'), 'custom'];
  const next = layoutsFromRiver(saved, EMPTY);
  assert.deepEqual(shown(next.stations), [
    'wave',
    'same_vibe',
    'deep_cuts',
    'adjacent',
    'top_artists',
    'discover',
  ]);
  assert.deepEqual(next.home, []);
});

test('sections hidden before the redesign stay hidden, the rest stay on', () => {
  const next = layoutsFromRiver(['moments', 'adjacent'], EMPTY);
  assert.deepEqual(shown(next.stations), [
    'wave',
    'same_vibe',
    'deep_cuts',
    'top_artists',
    'fresh_drops',
    'discover',
  ]);
});

test('the main wave can not arrive hidden', () => {
  assert.equal(layoutsFromRiver(ALL_HIDDEN, EMPTY).stations[0].hidden, false);
});

test('moments turned on become a home block right after the deck', () => {
  const saved = [...ALL_HIDDEN.filter((id) => id !== 'moments'), 'custom'];
  const home = [
    { id: 'shelf', hidden: false },
    { id: 'river', hidden: false },
    { id: 'likes', hidden: true },
  ];
  assert.deepEqual(shown(layoutsFromRiver(saved, { ...EMPTY, home }).home), [
    'shelf',
    'river',
    'moments',
  ]);
  assert.deepEqual(layoutsFromRiver(saved, EMPTY).home, [{ id: 'moments', hidden: false }]);
});
