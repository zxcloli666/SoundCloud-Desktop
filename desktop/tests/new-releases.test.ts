import assert from 'node:assert/strict';
import { test } from 'node:test';
import { announcement, recentOriginals, unseen } from '../src/lib/new-releases.ts';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const DAY = 86_400_000;

function release(id: number, artist: string, ageDays: number, extra: object = {}) {
  const at = NOW - ageDays * DAY;
  const track = {
    id,
    urn: `soundcloud:tracks:${id}`,
    title: `Track ${id}`,
    created_at: new Date(at).toISOString(),
    sharing: 'public',
    user: { id: 1, urn: `soundcloud:users:${artist}`, username: artist },
    ...extra,
  };
  return { track: track as never, at };
}

test('keeps 14 days, newest first, drops duplicates and private tracks', () => {
  const picked = recentOriginals(
    [
      release(1, 'A', 3),
      release(2, 'B', 0.2),
      release(3, 'A', 15),
      release(1, 'A', 3),
      release(4, 'C', 1, { sharing: 'private' }),
      release(5, 'C', -3),
      release(6, 'B', 13.9),
    ],
    NOW,
  );
  assert.deepEqual(
    picked.map((r) => r.track.id),
    [2, 1, 6],
  );
});

test('since last check: only urns not seen before', () => {
  const all = recentOriginals([release(1, 'A', 3), release(2, 'B', 1), release(7, 'C', 0.1)], NOW);
  const seen = new Set(['soundcloud:tracks:1', 'soundcloud:tracks:2']);
  assert.deepEqual(
    unseen(all, seen).map((r) => r.track.id),
    [7],
  );
  assert.equal(unseen(all, new Set(all.map((r) => r.track.urn))).length, 0);
});

test('announcement groups artists and caps names', () => {
  const fresh = [
    release(1, 'A', 0.1),
    release(2, 'A', 0.2),
    release(3, 'B', 0.3),
    release(4, 'C', 0.4),
    release(5, 'D', 0.5),
  ];
  assert.deepEqual(announcement(fresh), { count: 5, artists: ['A', 'B', 'C'], more: true });
  assert.deepEqual(announcement(fresh.slice(0, 2)), { count: 2, artists: ['A'], more: false });
});
