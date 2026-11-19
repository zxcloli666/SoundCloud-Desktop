import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emojiOf,
  forgetMoments,
  getMoment,
  restoreMoment,
  seedMoments,
  setOwnReaction,
} from '../src/lib/moment-reactions.ts';

const TRACK = 'soundcloud:tracks:7';
const FIRE = 'sc:interactiontypevalue:1f525';
const CLAP = 'sc:interactiontypevalue:1f44f';

test('a reaction adds one to its value and the second becomes own', () => {
  forgetMoments();
  seedMoments(TRACK, [{ second: 5, total: 2, counts: [{ valueUrn: FIRE, count: 2 }], own: null }]);
  setOwnReaction(TRACK, 5, FIRE);
  const moment = getMoment(TRACK, 5);
  assert.equal(moment?.own, FIRE);
  assert.equal(moment?.total, 3);
  assert.deepEqual(moment?.counts, [{ valueUrn: FIRE, count: 3 }]);
});

test('switching moves the count to the new value', () => {
  forgetMoments();
  seedMoments(TRACK, [{ second: 5, total: 1, counts: [{ valueUrn: FIRE, count: 1 }], own: FIRE }]);
  setOwnReaction(TRACK, 5, CLAP);
  const moment = getMoment(TRACK, 5);
  assert.equal(moment?.own, CLAP);
  assert.deepEqual(moment?.counts, [{ valueUrn: CLAP, count: 1 }]);
});

test('removing the only reaction leaves an empty moment', () => {
  forgetMoments();
  setOwnReaction(TRACK, 9, FIRE);
  setOwnReaction(TRACK, 9, null);
  assert.equal(getMoment(TRACK, 9)?.total, 0);
  assert.equal(getMoment(TRACK, 9)?.own, null);
});

test('restore brings back the moment before the change', () => {
  forgetMoments();
  const before = getMoment(TRACK, 3);
  setOwnReaction(TRACK, 3, FIRE);
  restoreMoment(TRACK, 3, before);
  assert.equal(getMoment(TRACK, 3), undefined);
});

test('a reading does not overwrite a fresh local change', () => {
  forgetMoments();
  setOwnReaction(TRACK, 5, FIRE, 1_000);
  seedMoments(TRACK, [{ second: 5, total: 0, counts: [], own: null }], 10_000);
  assert.equal(getMoment(TRACK, 5)?.own, FIRE);
  seedMoments(TRACK, [{ second: 5, total: 0, counts: [], own: null }], 200_000);
  assert.equal(getMoment(TRACK, 5), undefined);
});

test('an emoji comes from the known values or from the urn', () => {
  assert.equal(emojiOf(FIRE, [{ valueUrn: FIRE, emoji: 'X' }]), 'X');
  assert.equal(emojiOf(FIRE, []), '\u{1F525}');
  assert.equal(emojiOf('sc:interactiontypevalue:nope', []), '');
});
