import assert from 'node:assert/strict';
import { test } from 'node:test';
import { learned, marked, spoken } from '../src/lib/voice/readings.ts';

test('a latin name learns the cyrillic words it was called by', () => {
  const readings = learned({}, [
    ['Psychosis', 'психосис'],
    ['Скриптонит', 'скриптонит'],
    ['Nightmare', 'Nightmare'],
    ['', 'пусто'],
  ]);
  assert.deepEqual(readings, { psychosis: 'психосис' });
});

test('a newer reading replaces the old one and the oldest fall out', () => {
  let readings = learned({}, [['Psychosis', 'псякосис']]);
  readings = learned(readings, [['psychosis', 'психосис']]);
  assert.deepEqual(readings, { psychosis: 'психосис' });
  const many: [string, string][] = Array.from({ length: 410 }, (_, n) => [`band${n}`, `бэнд ${n}`]);
  const capped = learned(readings, many);
  assert.equal(Object.keys(capped).length, 400);
  assert.equal(capped.psychosis, undefined);
  assert.equal(capped.band409, 'бэнд 409');
});

test('a spoken line says known names the learned way', () => {
  const readings = { psychosis: 'психосис', '6ix9ine': 'Сикс Найн' };
  assert.equal(
    spoken(readings, 'Сейчас играет Psychosis — Nightmare'),
    'Сейчас играет Психосис — Nightmare',
  );
  assert.equal(spoken(readings, 'Включаю PSYCHOSIS'), 'Включаю Психосис');
  assert.equal(spoken(readings, 'Включаю 6ix9ine'), 'Включаю Сикс Найн');
  assert.equal(spoken(readings, 'Включаю Psychosis2'), 'Включаю Psychosis2');
});

test('chat marks give their readings', () => {
  assert.deepEqual(marked('Ищу [[6ix9ine|Сикс Найн]] [[Psychosis|Психосис]] нашёлся.'), [
    ['6ix9ine', 'Сикс Найн'],
    ['Psychosis', 'Психосис'],
  ]);
});
