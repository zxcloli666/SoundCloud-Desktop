import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressOf, roleAddress } from '../src/lib/voice/address.ts';
import type { ListenerConfig, RelationRole } from '../src/lib/voice/types.ts';

const NOBODY: ListenerConfig = { gender: null, name: '', address: null };

test('a ready role brings its usual address, the own role and no role bring none', () => {
  const usual = (['friend', 'mentor', 'assistant', 'butler', 'own'] as RelationRole[]).map(
    roleAddress,
  );
  assert.deepEqual(usual, ['informal', 'informal', 'formal', 'formal', null]);
  assert.equal(roleAddress(null), null);
});

test('a chosen address always wins over the one the role brings', () => {
  const formal = { ...NOBODY, address: 'formal' as const };
  const informal = { ...NOBODY, address: 'informal' as const };
  assert.equal(addressOf(formal, { role: 'friend', own: '' }), 'formal');
  assert.equal(addressOf(informal, { role: 'butler', own: '' }), 'informal');
  assert.equal(addressOf(formal, { role: null, own: '' }), 'formal');
  assert.equal(addressOf(NOBODY, { role: 'butler', own: '' }), 'formal');
  assert.equal(addressOf(NOBODY, { role: 'mentor', own: '' }), 'informal');
  assert.equal(addressOf(NOBODY, { role: 'own', own: 'Сосед по плейлисту' }), null);
  assert.equal(addressOf(NOBODY, { role: null, own: '' }), null);
});
