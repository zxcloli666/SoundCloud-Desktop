import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickVideo, videoOrder } from '../src/lib/video-pick.ts';
import type { TrackVideo } from '../src/stores/player.ts';

const video = (kind: string, loop = false): TrackVideo => ({
  kind,
  url: `https://storage.scnative.dev/video/1-${kind}.mp4`,
  offsetMs: 0,
  loop,
});

const all = [video('generated', true), video('loop', true), video('clip')];
const prefs = { order: ['clip', 'loop', 'generated'] as const, off: [] };
const none = new Set<string>();

test('the first kind in the user order wins', () => {
  assert.equal(pickVideo(all, { ...prefs, order: [...prefs.order] }, none)?.kind, 'clip');
  assert.equal(pickVideo(all, { order: ['generated', 'clip', 'loop'], off: [] }, none)?.kind, 'generated');
});

test('a switched off kind is skipped', () => {
  assert.equal(pickVideo(all, { order: [...prefs.order], off: ['clip'] }, none)?.kind, 'loop');
  assert.equal(pickVideo(all, { order: [...prefs.order], off: ['clip', 'loop', 'generated'] }, none), null);
});

test('a failed kind falls through to the next one', () => {
  assert.equal(pickVideo(all, { order: [...prefs.order], off: [] }, new Set(['clip']))?.kind, 'loop');
  assert.equal(
    pickVideo(all, { order: [...prefs.order], off: [] }, new Set(['clip', 'loop', 'generated'])),
    null,
  );
});

test('no videos means the cover', () => {
  assert.equal(pickVideo([], { order: [...prefs.order], off: [] }, none), null);
  assert.equal(pickVideo(undefined, { order: [...prefs.order], off: [] }, none), null);
});

test('an unknown kind from a newer backend is ignored', () => {
  assert.equal(pickVideo([video('hologram')], { order: [...prefs.order], off: [] }, none), null);
  assert.equal(
    pickVideo([video('hologram'), video('loop', true)], { order: [...prefs.order], off: [] }, none)?.kind,
    'loop',
  );
});

test('a broken saved order is repaired', () => {
  assert.deepEqual(videoOrder(['loop', 'loop', 'x']), ['loop', 'clip', 'generated']);
  assert.deepEqual(videoOrder([]), ['clip', 'loop', 'generated']);
});
