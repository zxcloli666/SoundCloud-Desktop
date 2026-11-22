import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnedTrack } from '../src/lib/voice/library.ts';
import {
  libraryNames,
  type ReadingsAnswer,
  readNames,
  spokenNames,
  withReadings,
} from '../src/lib/voice/library-readings.ts';

function track(name: string, artist: string): OwnedTrack {
  return { id: `soundcloud:tracks:${name}`, name, artist, plays: 0 };
}

const OWNED = [
  track('gothrussia', 'Psychosis'),
  track('x-ray', 'Psychosis'),
  track('Цепи', 'Скриптонит'),
];

test('russian asks for every latin name of the library once, artists first', () => {
  const names = libraryNames('ru', ['Psychosis', 'КРЕСТ', 'Lil Peep'], OWNED);
  assert.deepEqual(names, ['Psychosis', 'Lil Peep', 'gothrussia', 'x-ray']);
});

test('english asks for the cyrillic names instead', () => {
  assert.deepEqual(libraryNames('en', ['Psychosis', 'КРЕСТ'], OWNED), [
    'КРЕСТ',
    'Цепи',
    'Скриптонит',
  ]);
});

test('names are asked again while the server reads more of them', async () => {
  const lefts = [2, 1, 0];
  const asked: string[][] = [];
  const heard = await readNames('ru', ['gothrussia', 'x-ray', 'Psychosis'], async (_, names) => {
    asked.push(names);
    const left = lefts[asked.length - 1];
    const readings = left === 2 ? [{ name: 'gothrussia', said: 'гот раша' }] : [];
    return { readings, left } satisfies ReadingsAnswer;
  });
  assert.equal(asked.length, 3);
  assert.deepEqual(heard, { gothrussia: 'гот раша' });
});

test('a refused or stuck ask stops the reading with what was heard', async () => {
  let calls = 0;
  const stuck = await readNames('ru', ['gothrussia'], async () => {
    calls += 1;
    return { readings: [{ name: 'GothRussia', said: 'гот раша' }], left: 3 };
  });
  assert.equal(calls, 2);
  assert.deepEqual(stuck, { gothrussia: 'гот раша' });
  const refused = await readNames('ru', ['gothrussia'], async () => {
    throw new Error('403');
  });
  assert.deepEqual(refused, {});
  assert.deepEqual(await readNames('ru', [], async () => assert.fail('no ask')), {});
});

test('a big library is asked for in parts the server takes', async () => {
  const names = Array.from({ length: 1_200 }, (_, at) => `name ${at}`);
  const sizes: number[] = [];
  await readNames('ru', names, async (_, part) => {
    sizes.push(part.length);
    return { readings: [], left: 0 };
  });
  assert.deepEqual(sizes, [500, 500, 200]);
});

test('a track carries the readings of its title and its artist', () => {
  const heard = { gothrussia: 'гот раша', psychosis: 'психосис' };
  const [first, second] = withReadings(OWNED, heard);
  assert.deepEqual([first.said, first.artistSaid], [['гот раша'], ['психосис']]);
  assert.deepEqual([second.said, second.artistSaid], [[], ['психосис']]);
});

test('the spoken names put what the listener asked for first, then artists and favourite titles', () => {
  const heard = { gothrussia: 'гот раша', psychosis: 'психосис', 'lil peep': 'лил пип' };
  const asked = { soldier: 'солджер', psychosis: 'психосис' };
  const spoken = spokenNames(
    'ru',
    asked,
    ['Psychosis', 'КРЕСТ', 'aikko', 'Lil Peep'],
    OWNED.slice(0, 2),
    heard,
  );
  assert.deepEqual(spoken, ['психосис', 'солджер', 'КРЕСТ', 'лил пип', 'гот раша']);
});
