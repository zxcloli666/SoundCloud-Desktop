import assert from 'node:assert/strict';
import { test } from 'node:test';
import { queueFitsBeside } from '../src/lib/queue-dock.ts';

const OPEN = 196;
const COLLAPSED = 56;
const CHAT = 360;

test('a wide window has room for the queue beside the page', () => {
  assert.equal(queueFitsBeside(1440, OPEN, 0), true);
  assert.equal(queueFitsBeside(1440, COLLAPSED, CHAT), true);
  assert.equal(queueFitsBeside(1600, OPEN, CHAT), true);
  assert.equal(queueFitsBeside(1060, COLLAPSED, 0), true);
});

test('a narrow page keeps the queue over it', () => {
  assert.equal(queueFitsBeside(1060, OPEN, 0), false);
  assert.equal(queueFitsBeside(900, COLLAPSED, 0), false);
  assert.equal(queueFitsBeside(1440, OPEN, CHAT), false);
});
