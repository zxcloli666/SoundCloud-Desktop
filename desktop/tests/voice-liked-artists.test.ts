import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SCUser } from '../src/lib/hooks';
import { changesLikedArtists, likedArtists } from '../src/lib/voice/liked-artists.ts';
import type { Track } from '../src/stores/player';

function by(uploader: string, artist?: string): Track {
  return {
    user: { username: uploader },
    enrichment: artist ? { primary_artist: { name: artist } } : undefined,
  } as Track;
}

function followed(...names: string[]): SCUser[] {
  return names.map((username) => ({ username }) as SCUser);
}

test('the artists with the most liked tracks come first, then the followed ones', () => {
  const liked = [by('Queen'), by('Psychosis'), by('Psychosis'), by(' Кино ')];
  assert.deepEqual(likedArtists(liked, followed('Drake', 'Queen')), [
    'Psychosis',
    'Queen',
    'Кино',
    'Drake',
  ]);
});

test('a track counts for its artist, not for the account that uploaded it', () => {
  const liked = [by('Some Label', 'Eminem'), by('Other Label', 'Eminem'), by('Some Label')];
  assert.deepEqual(likedArtists(liked, []), ['Eminem', 'Some Label']);
});

test('the list stops at two hundred names', () => {
  const liked = Array.from({ length: 150 }, (_, at) => by(`liked ${at}`));
  const names = Array.from({ length: 150 }, (_, at) => `followed ${at}`);
  const artists = likedArtists(liked, followed(...names));
  assert.equal(artists.length, 200);
  assert.equal(artists[149], 'liked 149');
  assert.equal(artists[199], 'followed 49');
});

test('a liked track and a follow change the list, a liked playlist and a repost do not', () => {
  assert.equal(changesLikedArtists('/likes/tracks/soundcloud%3Atracks%3A1'), true);
  assert.equal(changesLikedArtists('/me/followings/soundcloud%3Ausers%3A2'), true);
  assert.equal(changesLikedArtists('/likes/playlists/soundcloud%3Aplaylists%3A3'), false);
  assert.equal(changesLikedArtists('/reposts/tracks/soundcloud%3Atracks%3A1'), false);
});
