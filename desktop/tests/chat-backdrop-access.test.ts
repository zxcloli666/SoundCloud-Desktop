import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  backdropAccess,
  clearsBackdrop,
  peerReady,
  reportsBackdrop,
  setsBackdrop,
} from '../src/components/chat/backdrop/access.ts';
import { postBodyLen, textBytes, textRoom } from '../src/lib/chat/post-body.ts';
import type { ConversationSummary, Member } from '../src/lib/chat/types.ts';

function chat(patch: Partial<ConversationSummary>): ConversationSummary {
  return {
    id: 'c',
    kind: 'direct',
    role: 'member',
    state: 'active',
    accepted: true,
    backdrop: null,
    ...patch,
  } as ConversationSummary;
}

function member(id: string, patch: Partial<Member> = {}): Member {
  return {
    user: { id, name: id, avatarUrl: null, permalink: null },
    role: 'member',
    state: 'active',
    accepted: true,
    joinedSeq: 0,
    invitedBy: null,
    ...patch,
  } as Member;
}

test('a direct chat waits for the peer before anyone sets a backdrop', () => {
  const direct = chat({});
  assert.equal(backdropAccess(direct, true, null), 'loading');
  assert.equal(backdropAccess(direct, true, false), 'pending');
  assert.equal(backdropAccess(direct, true, true), 'ready');
  assert.equal(backdropAccess(direct, false, true), 'star');
  assert.equal(peerReady([], 'me'), null);
  assert.equal(peerReady([member('me'), member('peer', { accepted: false })], 'me'), false);
  assert.equal(peerReady([member('me'), member('peer')], 'me'), true);
});

test('groups and the public chat keep the backdrop to their staff', () => {
  for (const kind of ['group', 'public'] as const) {
    assert.equal(backdropAccess(chat({ kind }), true, true), 'role');
    assert.equal(backdropAccess(chat({ kind, role: 'admin' }), true, true), 'ready');
    assert.equal(backdropAccess(chat({ kind, role: 'owner' }), false, true), 'star');
  }
  assert.equal(setsBackdrop(chat({ kind: 'self' })), true);
  assert.equal(setsBackdrop(chat({ kind: 'room', role: 'owner' })), false);
  assert.equal(setsBackdrop(chat({ kind: 'group', role: 'owner', state: 'left' })), false);
  assert.equal(clearsBackdrop(chat({ kind: 'public', role: 'admin' })), true);
  assert.equal(clearsBackdrop(chat({ kind: 'group', role: 'owner' })), false);
});

test('only an image set by someone else can be reported', () => {
  const image = { kind: 'image', mediaId: 'm', by: 'peer' } as const;
  assert.equal(reportsBackdrop(chat({ backdrop: image }), 'me'), true);
  assert.equal(reportsBackdrop(chat({ backdrop: image }), 'peer'), false);
  assert.equal(
    reportsBackdrop(chat({ backdrop: { kind: 'preset', id: 'a', by: 'peer' } }), 'me'),
    false,
  );
});

test('a post body is padded to whole blocks as the core does', () => {
  assert.equal(postBodyLen('   '), 0);
  assert.equal(postBodyLen('hi'), 256);
  assert.equal(postBodyLen('a'.repeat(245)), 256);
  assert.equal(postBodyLen('a'.repeat(246)), 512);
  assert.equal(textBytes('привет'), 12);
  const room = textRoom(512);
  assert.equal(postBodyLen('a'.repeat(room)), 512);
  assert.equal(postBodyLen('a'.repeat(room + 1)), 768);
});
