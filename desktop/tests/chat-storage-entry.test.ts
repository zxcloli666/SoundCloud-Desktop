import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storageMeter } from '../src/components/chat/storage/storage-meter.ts';

const MB = 1_048_576;
const usage = (bytes: number, reserved: number, quota: number, files: number) => ({
  bytes,
  reserved,
  quota,
  files,
  conversations: [],
});

test('the storage button waits for the media config', () => {
  assert.equal(storageMeter(null, usage(1, 0, 10, 1)), null);
});

test('before the usage call answers, the config numbers fill the ring', () => {
  assert.deepEqual(storageMeter({ used: 3 * MB, quota: 100 * MB }, null), {
    used: 3 * MB,
    quota: 100 * MB,
    full: false,
    files: null,
  });
});

test('fresh usage counts reserved uploads and wins over the config', () => {
  assert.deepEqual(storageMeter({ used: 3 * MB, quota: 100 * MB }, usage(5 * MB, MB, 50 * MB, 7)), {
    used: 6 * MB,
    quota: 50 * MB,
    full: false,
    files: 7,
  });
});

test('the ring turns to the full tone once used reaches the quota', () => {
  const full = storageMeter({ used: 0, quota: 0 }, usage(40 * MB, 10 * MB, 50 * MB, 3));
  assert.equal(full?.full, true);
  assert.equal(storageMeter({ used: 0, quota: 0 }, null)?.full, false);
});
