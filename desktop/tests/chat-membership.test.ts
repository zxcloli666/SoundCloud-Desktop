import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isActiveMember, isRequest } from '../src/lib/chat/membership.ts';
import type { ConversationSummary } from '../src/lib/chat/types.ts';

function chat(patch: Partial<ConversationSummary>): ConversationSummary {
  return {
    id: 'c',
    kind: 'direct',
    state: 'active',
    accepted: true,
    ...patch,
  } as ConversationSummary;
}

test('only an invite is a request', () => {
  const invite = chat({ state: 'invited', accepted: false });
  assert.equal(isRequest(invite), true);
  assert.equal(isActiveMember(invite), false);
});

test('an unanswered chat from a known sender is a chat', () => {
  const unanswered = chat({ accepted: false });
  assert.equal(isRequest(unanswered), false);
  assert.equal(isActiveMember(unanswered), true);
});

test('a chat the user left is neither', () => {
  const left = chat({ state: 'left' });
  assert.equal(isRequest(left), false);
  assert.equal(isActiveMember(left), false);
});
