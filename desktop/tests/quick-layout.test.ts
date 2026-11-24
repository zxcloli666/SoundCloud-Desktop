import assert from 'node:assert/strict';
import { test } from 'node:test';
import { restLast, staysLast } from '../src/lib/layout-rest.ts';

const ids = (entries: { id: string }[]) => entries.map((entry) => entry.id);

test('only the more row of quick access stays last', () => {
  assert.ok(staysLast('rest'));
  assert.ok(!staysLast('more'));
});

test('a more row saved in the middle goes to the end, the rest keeps its order', () => {
  const saved = [{ id: 'likes' }, { id: 'rest' }, { id: 'history' }, { id: 'stats' }];
  assert.deepEqual(ids(restLast(saved)), ['likes', 'history', 'stats', 'rest']);
});
