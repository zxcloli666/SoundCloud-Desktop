import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeThumbhash, encodeThumbhash, thumbhashRatio } from './thumbhash.ts';

const vectors = JSON.parse(
  readFileSync(
    new URL(
      '../../../../src-tauri/src/chat/download/tests/thumbhash-vectors.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

function pixel(name, x, y, w, h, seed) {
  const c = (v) => v & 255;
  switch (name) {
    case 'landscape':
      return [c(x * 6), c(y * 8), c(128 + x * y), 255];
    case 'portrait':
      return [c(30 + (Math.floor(x / 6) % 2) * 180), c(y * 5), c(200 - y * 3), 255];
    case 'rings': {
      const d = (x - 16) ** 2 + (y - 16) ** 2;
      return [c(d * 2), c(255 - d), c(90 + Math.floor(d / 3)), 255];
    }
    case 'alpha':
      return [220, c(40 + y * 6), c(x * 7), c(Math.floor((x * 255) / (w - 1)))];
    case 'alpha-portrait':
      return [c(x * 12), 60, c(250 - y * 8), c(y < Math.floor(h / 2) ? 255 : (h - 1 - y) * 17)];
    case 'noise': {
      const next = () => {
        seed.s ^= seed.s << 13;
        seed.s >>>= 0;
        seed.s ^= seed.s >>> 17;
        seed.s ^= seed.s << 5;
        seed.s >>>= 0;
        return seed.s;
      };
      return [c(next()), c(next()), c(next()), 255];
    }
    case 'flat':
      return [70, 140, 210, 255];
    case 'line':
      return [c(x * 5), c(255 - x * 5), c(100 + y * 100), 255];
  }
  throw new Error(name);
}

function source({ name, w, h }) {
  const seed = { s: 0x9e3779b9 };
  const rgba = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) rgba.push(...pixel(name, x, y, w, h, seed));
  return rgba;
}

for (const vector of vectors) {
  test(`${vector.name}: the lab encoder writes the reference hash`, () => {
    assert.deepEqual(encodeThumbhash(vector.w, vector.h, source(vector)), vector.hash);
  });

  test(`${vector.name}: the decoder draws the reference picture`, () => {
    const decoded = decodeThumbhash(vector.hash);
    const expected = Buffer.from(vector.out.rgba, 'base64');
    assert.ok(decoded);
    assert.equal(decoded.w, vector.out.w);
    assert.equal(decoded.h, vector.out.h);
    assert.equal(decoded.rgba.length, expected.length);
    let worst = 0;
    for (let i = 0; i < expected.length; i++) {
      worst = Math.max(worst, Math.abs(decoded.rgba[i] - expected[i]));
    }
    assert.ok(worst <= 1, `off by ${worst}`);
    assert.ok(Math.abs(thumbhashRatio(vector.hash) - vector.ratio) < 1e-6);
  });
}

test('a short or cut hash decodes to nothing', () => {
  assert.equal(decodeThumbhash([]), null);
  assert.equal(decodeThumbhash([1, 2, 3, 4]), null);
  assert.equal(decodeThumbhash(vectors[0].hash.slice(0, 8)), null);
  assert.equal(decodeThumbhash(vectors[3].hash.slice(0, 5)), null);
});

test('a hash with no luminance width decodes to nothing', () => {
  assert.equal(decodeThumbhash([0, 0, 0, 0, 0]), null);
});

test('an oversized or mismatched picture is not encoded', () => {
  assert.deepEqual(encodeThumbhash(101, 1, new Array(404).fill(0)), []);
  assert.deepEqual(encodeThumbhash(2, 2, [0, 0, 0]), []);
});
