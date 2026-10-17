import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compareVersions,
  imageSize,
  isCleanText,
  isThemePath,
  sniffAssetType,
  THEME_ID,
} from '../../desktop/src/lib/themes/rules.ts';

const bytes = (...parts) =>
  new Uint8Array(
    parts.flatMap((part) => (typeof part === 'string' ? [...Buffer.from(part, 'latin1')] : part)),
  );

test('compareVersions compares numbers, not strings', () => {
  assert.ok(compareVersions('8.10.0', '8.6.0') > 0);
  assert.ok(compareVersions('1.0.0', '1.0.1') < 0);
  assert.equal(compareVersions('2.3.4', '2.3.4'), 0);
  assert.ok(compareVersions('10.0.0', '9.99.99') > 0);
  assert.ok(compareVersions('1.2.10', '1.2.9') > 0);
  assert.ok(compareVersions('123456789012345678901.0.0', '123456789012345678900.0.0') > 0);
});

test('isCleanText rejects bidi, zero width, controls and padding', () => {
  assert.equal(isCleanText('Midnight', 32), true);
  assert.equal(isCleanText('Глубокий синий', 140), true);
  assert.equal(isCleanText('abc‮def', 32), false);
  assert.equal(isCleanText('abc​def', 32), false);
  assert.equal(isCleanText('a\nb', 32), false);
  assert.equal(isCleanText('a b', 32), false);
  assert.equal(isCleanText(' padded', 32), false);
  assert.equal(isCleanText('', 32), false);
  assert.equal(isCleanText('x'.repeat(33), 32), false);
  assert.equal(isCleanText('x'.repeat(32), 32), true);
});

test('isThemePath accepts only theme files', () => {
  assert.equal(isThemePath('theme.css'), true);
  assert.equal(isThemePath('preview.webp'), true);
  assert.equal(isThemePath('preview.png'), true);
  assert.equal(isThemePath('assets/stars.svg'), true);
  assert.equal(isThemePath('assets/../theme.json'), false);
  assert.equal(isThemePath('assets/sub/a.png'), false);
  assert.equal(isThemePath('theme.json'), false);
  assert.equal(isThemePath('preview.jpg'), false);
  assert.equal(isThemePath('assets/A.png'), false);
});

test('THEME_ID shape', () => {
  assert.ok(THEME_ID.test('midnight'));
  assert.ok(THEME_ID.test('a-b'));
  assert.ok(!THEME_ID.test('ab'));
  assert.ok(!THEME_ID.test('-ab'));
  assert.ok(!THEME_ID.test('Midnight'));
});

test('sniffAssetType reads magic bytes', () => {
  assert.equal(sniffAssetType(bytes([0x89], 'PNG\r\n\x1a\n', [0, 0])), 'png');
  assert.equal(sniffAssetType(bytes([0xff, 0xd8, 0xff, 0xe0])), 'jpeg');
  assert.equal(sniffAssetType(bytes('GIF89a', [1, 0])), 'gif');
  assert.equal(sniffAssetType(bytes('GIF87a')), 'gif');
  assert.equal(sniffAssetType(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 ')), 'webp');
  assert.equal(sniffAssetType(bytes([0, 0, 0, 0x1c], 'ftypavif')), 'avif');
  assert.equal(sniffAssetType(bytes([0, 0, 0, 0x1c], 'ftypavis')), 'avif');
  assert.equal(sniffAssetType(bytes([0, 0, 0, 0x1c], 'ftypheic')), null);
  assert.equal(sniffAssetType(bytes('wOF2', [0, 1, 0, 0])), 'woff2');
  assert.equal(sniffAssetType(bytes('wOFF')), null);
  assert.equal(sniffAssetType(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'svg');
  assert.equal(sniffAssetType(bytes([0xef, 0xbb, 0xbf], '\n <?xml version="1.0"?><svg/>')), 'svg');
  assert.equal(sniffAssetType(bytes('<!-- x --><svg/>')), 'svg');
  assert.equal(sniffAssetType(bytes('<?xml version="1.0"?><html/>')), null);
  assert.equal(sniffAssetType(bytes('hello <svg/>')), null);
  assert.equal(sniffAssetType(bytes([0xff, 0xfe], '<\0s\0v\0g\0')), null);
  assert.equal(sniffAssetType(bytes('RIFF')), null);
  assert.equal(sniffAssetType(new Uint8Array()), null);
});

test('imageSize reads every raster kind', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  assert.deepEqual(imageSize(png), { width: 1, height: 1 });
  const riff = (chunk, body) => {
    const data = Buffer.concat([Buffer.from(chunk, 'latin1'), Buffer.alloc(4), body]);
    data.writeUInt32LE(body.length, 4);
    const head = Buffer.from('RIFF\0\0\0\0WEBP', 'latin1');
    head.writeUInt32LE(4 + data.length, 4);
    return Buffer.concat([head, data]);
  };
  const lossy = Buffer.from([0, 0, 0, 0x9d, 0x01, 0x2a, 0, 0, 0, 0]);
  lossy.writeUInt16LE(1280, 6);
  lossy.writeUInt16LE(800, 8);
  assert.deepEqual(imageSize(riff('VP8 ', lossy)), { width: 1280, height: 800 });
  const lossless = Buffer.alloc(5);
  lossless[0] = 0x2f;
  lossless.writeUInt32LE((1279 | (799 << 14)) >>> 0, 1);
  assert.deepEqual(imageSize(riff('VP8L', lossless)), { width: 1280, height: 800 });
  const extended = Buffer.alloc(10);
  extended.writeUIntLE(69999, 4, 3);
  extended.writeUIntLE(999, 7, 3);
  assert.deepEqual(imageSize(riff('VP8X', extended)), { width: 70000, height: 1000 });

  const gif = bytes(
    'GIF89a',
    [16, 0, 16, 0, 0x80, 0, 0],
    [0, 0, 0, 255, 255, 255],
    [0x21, 0xf9, 4, 0, 0, 0, 0, 0],
    [0x2c, 0, 0, 0, 0, 0x88, 0x13, 0x10, 0, 0],
    [2, 2, 0x44, 0x01, 0],
    [0x3b],
  );
  assert.deepEqual(imageSize(gif), { width: 5000, height: 16 });

  const jpeg = bytes(
    [0xff, 0xd8],
    [0xff, 0xe0, 0, 6],
    'JFIF',
    [0xff, 0xc2, 0, 11, 8, 0x01, 0x2c, 0x02, 0x58, 1, 1, 0x11, 0],
    [0xff, 0xd9],
  );
  assert.deepEqual(imageSize(jpeg), { width: 600, height: 300 });

  const box = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(8 + body.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, body]);
  };
  const ispe = (width, height) => {
    const body = Buffer.alloc(12);
    body.writeUInt32BE(width, 4);
    body.writeUInt32BE(height, 8);
    return box('ispe', body);
  };
  const avif = Buffer.concat([
    box('ftyp', Buffer.from('avif\0\0\0\0mif1', 'latin1')),
    box('meta', Buffer.concat([ispe(640, 400), ispe(8000, 200)])),
  ]);
  assert.deepEqual(imageSize(avif), { width: 8000, height: 400 });

  assert.equal(imageSize(bytes('GIF89a')), null);
  assert.equal(imageSize(png.subarray(0, 20)), null);
  assert.equal(imageSize(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xd9])), null);
  assert.equal(imageSize(box('ftyp', Buffer.from('avif', 'latin1'))), null);
  assert.equal(imageSize(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
});
