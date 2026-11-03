import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { HistoryEntry } from '../src/lib/import-session.ts';
import {
  cleanHistory,
  PLAYLIST_LIMIT,
  planAppend,
  stripToken,
  syncSourceOf,
} from '../src/lib/import-sync-plan.ts';

const urns = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => `soundcloud:tracks:${from + i}`);

test('fills the room left in the last chunk before creating the next one', () => {
  const steps = planAppend('Mix', [{ urn: 'p1', count: PLAYLIST_LIMIT - 2 }], urns(1, 5));
  assert.deepEqual(
    steps.map((step) => [step.urn, step.title, step.urns.length]),
    [
      ['p1', 'Mix', 2],
      [null, 'Mix 2', 3],
    ],
  );
  assert.deepEqual(steps[1].urns, urns(3, 3));
});

test('a full chunk rolls over and later chunks keep the import naming', () => {
  const chunks = [
    { urn: 'p1', count: PLAYLIST_LIMIT },
    { urn: 'p2', count: PLAYLIST_LIMIT },
  ];
  const steps = planAppend('Mix', chunks, urns(1, PLAYLIST_LIMIT + 10));
  assert.deepEqual(
    steps.map((step) => [step.urn, step.title, step.urns.length]),
    [
      [null, 'Mix 3', PLAYLIST_LIMIT],
      [null, 'Mix 4', 10],
    ],
  );
});

test('rollover across chunks never repeats or loses a track', () => {
  const chunks = [
    { urn: 'p1', count: 499 },
    { urn: 'p2', count: 500 },
    { urn: 'p3', count: 100 },
  ];
  const input = urns(1, 1000);
  const steps = planAppend('Mix', chunks, input);
  const flat = steps.flatMap((step) => step.urns);
  assert.deepEqual(flat, input);
  assert.equal(new Set(flat).size, input.length);
  assert.ok(steps.every((step) => step.urns.length <= PLAYLIST_LIMIT));
  assert.equal(steps[0].urn, 'p1');
  assert.equal(steps[1].urn, 'p3');
});

test('nothing to add plans nothing', () => {
  assert.deepEqual(planAppend('Mix', [{ urn: 'p1', count: 3 }], []), []);
});

const SECRET = 'y0_AgAAAA-secret-token';

test('the token never reaches the history entry', () => {
  const requests = [
    { kind: 'ym_likes' as const, token: SECRET },
    { kind: 'ym_playlist' as const, token: SECRET, owner: 'me', playlist: '3' },
    { kind: 'link' as const, url: 'https://music.yandex.ru/users/me/playlists/3', token: SECRET },
  ];
  for (const request of requests) {
    const entry: HistoryEntry = {
      id: '1',
      at: 1,
      kind: 'yandex',
      title: 't',
      total: 1,
      found: 1,
      request: null,
      playlistUrn: null,
      sync: syncSourceOf(request, { mode: 'likes' }),
    };
    assert.ok(!JSON.stringify([entry]).includes(SECRET));
    assert.ok(!JSON.stringify(stripToken(request)).includes(SECRET));
  }
});

test('old history entries that still hold a token are cleaned on load', () => {
  const dirty = [
    {
      id: '1',
      at: 1,
      kind: 'ym_likes',
      title: 't',
      total: 1,
      found: 1,
      request: null,
      playlistUrn: null,
      sync: { request: { kind: 'ym_likes', token: SECRET }, target: { mode: 'likes' } },
    },
  ] as HistoryEntry[];
  assert.ok(!JSON.stringify(cleanHistory(dirty)).includes(SECRET));
});
