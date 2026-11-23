import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OpenRoom } from '../src/lib/together/types.ts';
import { pickOpen, showRooms } from '../src/lib/voice/chat/open-rooms.ts';

function room(hostName: string, listeners: number, full = false): OpenRoom {
  return {
    hostId: `id-${hostName}`,
    hostName,
    hostAvatarUrl: null,
    status: 'playing',
    track: { title: 'Faded', artist: 'Psychosis', artworkUrl: null },
    listeners,
    capacity: 8,
    full,
    createdAt: 0,
  } as OpenRoom;
}

const ROOMS = [room('Mira', 2), room('Big Oleg', 7, true), room('Kate', 5)];

test('a public room without a host is the busiest one with a free seat', () => {
  assert.equal(pickOpen(ROOMS, '')?.hostName, 'Kate');
  assert.equal(pickOpen([room('Big Oleg', 7, true)], ''), null);
});

test('a public room is found by its host name said loosely, a full one is still found', () => {
  assert.equal(pickOpen(ROOMS, ' mira ')?.hostId, 'id-Mira');
  assert.equal(pickOpen(ROOMS, 'oleg')?.hostId, 'id-Big Oleg');
  assert.equal(pickOpen(ROOMS, 'Nobody'), null);
});

test('rooms shown to the model put free seats first and keep what plays', () => {
  assert.deepEqual(
    showRooms(ROOMS).map((r) => [r.host, r.track, r.full]),
    [
      ['Kate', 'Faded - Psychosis', false],
      ['Mira', 'Faded - Psychosis', false],
      ['Big Oleg', 'Faded - Psychosis', true],
    ],
  );
});
