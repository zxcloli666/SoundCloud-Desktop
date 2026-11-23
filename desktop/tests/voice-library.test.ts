import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ownedTracks } from '../src/lib/voice/library.ts';
import type { Track } from '../src/stores/player';

function track(id: number, title: string, uploader: string, extra: Partial<Track> = {}): Track {
  return {
    urn: `soundcloud:tracks:${id}`,
    title,
    user: { username: uploader },
    ...extra,
  } as Track;
}

test('a library track keeps its urn, title, artist and plays', () => {
  const liked = [
    track(2, 'gothrussia', 'Psychosis', { playback_count: 23_000 }),
    track(3, 'Притон', 'Some Label', {
      enrichment: { primary_artist: { name: 'Скриптонит' } },
    } as Partial<Track>),
  ];
  assert.deepEqual(ownedTracks(liked), [
    { id: 'soundcloud:tracks:2', name: 'gothrussia', artist: 'Psychosis', plays: 23_000 },
    { id: 'soundcloud:tracks:3', name: 'Притон', artist: 'Скриптонит', plays: 0 },
  ]);
});

test('a track both superliked and liked is sent once, superlikes first', () => {
  const superliked = [track(1, 'Nightmare', 'Psychosis')];
  const liked = [track(4, 'Komori', 'Komori'), track(1, 'Nightmare', 'Psychosis')];
  assert.deepEqual(
    ownedTracks(superliked, liked).map((t) => t.id),
    ['soundcloud:tracks:1', 'soundcloud:tracks:4'],
  );
});

test('a track without a urn or a title is left out', () => {
  const broken = [{ title: 'no urn' } as Track, track(5, '  ', 'Кино')];
  assert.deepEqual(ownedTracks(broken), []);
});
