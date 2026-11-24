import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickByTitle } from '../src/lib/playlist-pick.ts';

const PLAYLISTS = ['Ночная дорога', 'Ночь', 'Для машины', 'lofi для работы'].map((title) => ({
  title,
}));

test('a playlist is found by its exact name, its start, then its words', () => {
  assert.equal(pickByTitle(PLAYLISTS, 'ночь')?.title, 'Ночь');
  assert.equal(pickByTitle(PLAYLISTS, 'Ночн')?.title, 'Ночная дорога');
  assert.equal(pickByTitle(PLAYLISTS, 'работы lofi')?.title, 'lofi для работы');
  assert.equal(pickByTitle(PLAYLISTS, 'тренировка'), null);
  assert.equal(pickByTitle(PLAYLISTS, '  '), null);
});
