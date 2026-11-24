import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ownsSpace, watchClickedButton } from '../src/lib/clicked-button.ts';

class FakeElement extends EventTarget {
  closest() {
    return this;
  }
}

function pageEvent(type: string, target: FakeElement | null, code = '') {
  const event = new Event(type);
  Object.defineProperties(event, { target: { value: target }, code: { value: code } });
  return event;
}

const page = new EventTarget();
Object.assign(globalThis, { window: page, Element: FakeElement });
const minimize = new FakeElement();
const like = new FakeElement();
const press = (button: FakeElement) => page.dispatchEvent(pageEvent('pointerdown', button));
const tab = () => page.dispatchEvent(pageEvent('keydown', null, 'Tab'));

test('space leaves a button that was only clicked to the player', () => {
  const stop = watchClickedButton();
  press(minimize);
  assert.equal(ownsSpace(minimize), false);
  assert.equal(ownsSpace(like), true);
  stop();
});

test('space presses a button reached with the keyboard', () => {
  const stop = watchClickedButton();
  press(minimize);
  tab();
  assert.equal(ownsSpace(minimize), true);
  stop();
});

test('space outside of buttons is for the player', () => {
  assert.equal(ownsSpace(page), false);
});
