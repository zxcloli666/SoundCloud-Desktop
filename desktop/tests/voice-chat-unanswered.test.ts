import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unansweredTurns } from '../src/lib/voice/chat/unanswered.ts';

const first = { id: 'a', heard: 'психосис гот раша включи мне', answered: false };

test('a phrase cut off before any answer goes to the model with the next one', () => {
  const turns = unansweredTurns(20_000);
  turns.leave(first, 1_000);
  assert.equal(
    turns.text('b', 'ну включи', 4_000, null),
    'психосис гот раша включи мне\nну включи',
  );
});

test('a phrase still running without an answer is read together with the new one', () => {
  const turns = unansweredTurns(20_000);
  assert.equal(
    turns.text('b', 'ну включи', 4_000, first),
    'психосис гот раша включи мне\nну включи',
  );
  turns.leave(first, 4_100);
  assert.equal(
    turns.text('b', 'ну включи', 4_200, first),
    'психосис гот раша включи мне\nну включи',
  );
});

test('an answered, old or own phrase is not repeated', () => {
  const turns = unansweredTurns(20_000);
  turns.leave({ ...first, answered: true }, 1_000);
  assert.equal(turns.text('b', 'дальше', 2_000, null), 'дальше');
  turns.leave(first, 1_000);
  assert.equal(turns.text('b', 'дальше', 30_000, null), 'дальше');
  assert.equal(turns.text('a', first.heard, 2_000, first), first.heard);
  turns.clear();
  assert.equal(turns.text('c', 'дальше', 2_000, null), 'дальше');
});
