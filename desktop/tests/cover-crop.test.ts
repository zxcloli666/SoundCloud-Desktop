import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COVER_MAX,
  COVER_MIN,
  coverTooSmall,
  fullFrame,
  maxZoom,
  outputSide,
  panFrame,
  zoomFrame,
  zoomOf,
} from '../src/lib/cover-crop.ts';

const wide = { width: 2400, height: 1200 };

test('a new frame is the centered full square of the short side', () => {
  assert.deepEqual(fullFrame(wide), { x: 1200, y: 600, side: 1200 });
  assert.equal(zoomOf(fullFrame(wide), wide), 1);
});

test('panning stops at the image edge', () => {
  const left = panFrame(fullFrame(wide), 10_000, 0, 300, wide);
  assert.equal(left.x, 600);
  const right = panFrame(fullFrame(wide), -10_000, 0, 300, wide);
  assert.equal(right.x, 1800);
  assert.equal(panFrame(fullFrame(wide), 0, 500, 300, wide).y, 600);
});

test('dragging moves the frame by screen pixels scaled to the image', () => {
  const moved = panFrame(fullFrame(wide), -30, 0, 300, wide);
  assert.equal(moved.x, 1200 + 30 * (1200 / 300));
});

test('zoom never shows fewer source pixels than the cover minimum', () => {
  const frame = zoomFrame(fullFrame(wide), 100, wide);
  assert.equal(frame.side, COVER_MIN);
  assert.equal(zoomOf(frame, wide), maxZoom(wide));
  assert.equal(zoomFrame(frame, 0.2, wide).side, 1200);
});

test('a small image cannot zoom and a tiny one is refused', () => {
  assert.equal(maxZoom({ width: 300, height: 900 }), 1);
  assert.equal(coverTooSmall({ width: 299, height: 900 }), true);
  assert.equal(coverTooSmall({ width: 300, height: 300 }), false);
});

test('the uploaded side is capped and keeps small crops as they are', () => {
  assert.equal(outputSide(fullFrame(wide)), COVER_MAX);
  assert.equal(outputSide({ x: 400, y: 400, side: 640.4 }), 640);
});
