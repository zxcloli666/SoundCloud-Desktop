import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONTROLS_SHOWN,
  clipped,
  fitted,
  labelOf,
  roleOf,
  SCREEN_BYTES,
  type Screen,
  type SeenControl,
  trimmed,
} from '../src/lib/voice/screen/shape.ts';

test('a control is named by the first text it has, on one line and clipped', () => {
  assert.equal(labelOf(null, '  ', 'Показать\n  всё '), 'Показать всё');
  assert.equal(labelOf('Лайк', 'Like this track'), 'Лайк');
  assert.equal(labelOf(undefined, ''), '');
  const long = labelOf('а'.repeat(100));
  assert.equal(Array.from(long).length, 48);
  assert.ok(long.endsWith('…'));
  assert.equal(clipped('ok', 10), 'ok');
});

test('the role comes from aria first, then from the tag and input type', () => {
  assert.equal(roleOf('div', null, 'switch'), 'switch');
  assert.equal(roleOf('div', null, 'searchbox'), 'field');
  assert.equal(roleOf('button', null, null), 'button');
  assert.equal(roleOf('a', null, null), 'link');
  assert.equal(roleOf('input', 'checkbox', null), 'checkbox');
  assert.equal(roleOf('input', 'range', null), 'slider');
  assert.equal(roleOf('input', null, null), 'field');
  assert.equal(roleOf('input', 'hidden', null), null);
  assert.equal(roleOf('div', null, null), null);
  assert.equal(roleOf('div', null, 'presentation'), null);
});

function control(label: string, role: SeenControl['role'] = 'button'): SeenControl {
  return { role, label };
}

test('repeated controls are kept twice at most and the list is capped', () => {
  const seen = [
    control('Ещё'),
    control('ещё'),
    control('Ещё'),
    control('Ещё', 'link'),
    control('Лайк'),
  ];
  assert.deepEqual(
    trimmed(seen).map((c) => `${c.role}:${c.label}`),
    ['button:Ещё', 'button:ещё', 'link:Ещё', 'button:Лайк'],
  );
  const many = Array.from({ length: 90 }, (_, at) => control(`Кнопка ${at}`));
  assert.equal(trimmed(many).length, CONTROLS_SHOWN);
});

function crowded(tracks: number, controls: number): Screen {
  return {
    page: 'search',
    title: 'Поиск',
    tracks: Array.from({ length: tracks }, (_, at) => ({
      n: at + 1,
      title: 'Очень длинное название трека на кириллице'.repeat(2).slice(0, 60),
      artist: 'Исполнитель с длинным именем',
      id: `soundcloud:tracks:${1_000_000_000 + at}`,
    })),
    controls: Array.from({ length: controls }, (_, at) => ({
      ref: `c${at + 1}`,
      role: 'button' as const,
      label: 'Кнопка с довольно длинной подписью на экране',
    })),
    more_below: true,
  };
}

test('a crowded screen is cut from the end of the longer list until it fits', () => {
  const full = crowded(20, 40);
  const fit = fitted(full);
  assert.ok(new TextEncoder().encode(JSON.stringify(fit)).length <= SCREEN_BYTES);
  assert.ok(fit.tracks.length >= 8, `${fit.tracks.length}`);
  assert.ok(fit.controls.length >= 8, `${fit.controls.length}`);
  assert.deepEqual(fit.tracks, full.tracks.slice(0, fit.tracks.length));
  assert.deepEqual(fit.controls, full.controls.slice(0, fit.controls.length));
  const small = crowded(2, 3);
  assert.deepEqual(fitted(small), small);
});
