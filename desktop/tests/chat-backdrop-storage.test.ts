import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storedProblem } from '../src/components/chat/backdrop/errors.ts';
import type { PhotoState } from '../src/components/chat/backdrop/PhotoTile.tsx';
import { imageGate, uploadStatus } from '../src/components/chat/backdrop/photo-state.ts';
import { storedChoices, worthAsking } from '../src/components/chat/backdrop/stored-list.ts';
import type { MyMedia, UploadView } from '../src/lib/chat/media-types.ts';

const upload: UploadView = {
  id: 'u-1',
  album: 'a-1',
  position: 0,
  conversationId: 'c-room',
  kind: 'backdrop',
  state: 'uploading',
  object: 'image',
  partsSent: 4,
  imageBytes: 400_000,
  thumbBytes: 0,
  attempts: 1,
  updatedAt: 1,
};

function item(id: string, change: Partial<MyMedia> = {}): MyMedia {
  return {
    id,
    kind: 'image',
    conversation_id: 'c-group',
    thumb_id: `${id}-t`,
    bytes: 200_000,
    status: 'attached',
    chats: 1,
    created_at: 1_000,
    ...change,
  };
}

const STATES: PhotoState[] = [
  { kind: 'idle' },
  { kind: 'current', src: 'chatmedia://localhost/c-room/m-1/image' },
  { kind: 'failed' },
  { kind: 'cooldown', leftMs: 60_000 },
  { kind: 'uploading', upload },
  { kind: 'uploading', upload: null },
];

test('the storage choice opens exactly when the own photo choice would act', () => {
  const acts = STATES.map((state) => imageGate(state, false, true).acts);
  assert.deepEqual(acts, [true, true, true, false, false, false]);
  const disabled = STATES.map((state) => imageGate(state, false, true).disabled);
  assert.deepEqual(disabled, [false, false, false, true, true, true]);
});

test('a locked or still linking room never opens the storage sheet', () => {
  for (const state of STATES) {
    assert.equal(imageGate(state, false, false).acts, false);
    const linking = imageGate(state, true, false);
    assert.deepEqual(linking, { disabled: true, acts: false });
  }
  assert.deepEqual(imageGate({ kind: 'idle' }, false, false), { disabled: false, acts: false });
});

test('a storage pick shows as an upload at once, before the upload row exists', () => {
  const failed = { ...upload, state: 'failed' as const };
  assert.deepEqual(uploadStatus(failed, { code: 'offline' }, true), {
    kind: 'active',
    upload: null,
  });
  assert.deepEqual(uploadStatus(failed, { code: 'offline' }), { kind: 'failed' });
  assert.deepEqual(uploadStatus(upload, null, false), { kind: 'active', upload });
  assert.equal(uploadStatus(null, null), null);
});

test('only committed images with a key here and still alive are offered, newest order kept', () => {
  const items = [
    item('fresh', { status: 'uploaded', chats: 0 }),
    item('lost', { status: 'lost' }),
    item('avatar', { kind: 'avatar', thumb_id: null }),
    item('elsewhere'),
    item('deleted'),
    item('gone'),
    item('backdrop', { kind: 'backdrop', thumb_id: null }),
    item('current', { kind: 'backdrop', thumb_id: null, conversation_id: 'c-room' }),
    item('sent'),
  ];
  const known = new Set(items.map((entry) => entry.id).filter((id) => id !== 'elsewhere'));
  const choices = storedChoices(items, {
    known,
    gone: { deleted: 'deleted', gone: 'lost', sent: 'ready' },
    current: 'current',
  });
  assert.deepEqual(
    choices.map((entry) => entry.id),
    ['fresh', 'backdrop', 'sent'],
  );
});

test('lost rows and avatars are never sent to the key check', () => {
  assert.equal(worthAsking(item('a')), true);
  assert.equal(worthAsking(item('b', { status: 'uploaded' })), true);
  assert.equal(worthAsking(item('c', { status: 'lost' })), false);
  assert.equal(worthAsking(item('d', { kind: 'avatar' })), false);
  assert.equal(worthAsking(item('e', { kind: 'backdrop' })), true);
});

test('a stored image that is gone asks for another one from storage', () => {
  const now = 1_000;
  const gone = storedProblem({ code: 'media_missing', ids: ['m-1'] }, now);
  assert.equal(gone.key, 'chat.backdrop.errors.stored_gone');
  assert.equal(gone.fix, 'stored');
  assert.equal(storedProblem({ code: 'not_found' }, now).key, 'chat.backdrop.errors.generic');
  assert.equal(storedProblem({ code: 'offline' }, now).fix, 'retry');
  assert.equal(storedProblem({ code: 'room_star_required' }, now).fix, 'star');
  const cooldown = storedProblem({ code: 'backdrop_cooldown', until: 5_000 }, now);
  assert.deepEqual([cooldown.fix, cooldown.until], ['wait', 5_000]);
});
