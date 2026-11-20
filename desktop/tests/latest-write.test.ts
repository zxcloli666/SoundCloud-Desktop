import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestWrites } from '../src/lib/latest-write.ts';

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

function disk(took: (value: string) => number) {
  const kept = new Map<string, string>();
  const puts: string[] = [];
  let busy = 0;
  let most = 0;
  const files = latestWrites<string>(async (name, value) => {
    busy++;
    most = Math.max(most, busy);
    puts.push(value);
    await pause(took(value));
    kept.set(name, value);
    busy--;
  });
  return { files, kept, puts, most: () => most };
}

test('the newest value is the one that stays', async () => {
  const { files, kept, puts, most } = disk((value) => (value === 'long' ? 20 : 1));
  const done = [
    files.write('voice', 'long'),
    files.write('voice', 'mid'),
    files.write('voice', 'short'),
  ];
  await Promise.all(done);
  assert.equal(kept.get('voice'), 'short');
  assert.deepEqual(puts, ['long', 'short']);
  assert.equal(most(), 1);
});

test('a value set while the last one is being written is not lost', async () => {
  const { files, kept } = disk(() => 5);
  const first = files.write('voice', 'one');
  await pause(1);
  const second = files.write('voice', 'two');
  await first;
  await second;
  assert.equal(kept.get('voice'), 'two');
  await files.write('voice', 'three');
  assert.equal(kept.get('voice'), 'three');
});

test('files do not wait for each other', async () => {
  const { files, kept, most } = disk(() => 10);
  await Promise.all([files.write('voice', 'a'), files.write('player', 'b')]);
  assert.equal(kept.get('voice'), 'a');
  assert.equal(kept.get('player'), 'b');
  assert.equal(most(), 2);
});

test('a failed write does not stop the next one', async () => {
  const kept = new Map<string, string>();
  const files = latestWrites<string>(async (name, value) => {
    if (value === 'bad') throw new Error('disk');
    kept.set(name, value);
  });
  await files.write('voice', 'bad');
  await files.write('voice', 'good');
  assert.equal(kept.get('voice'), 'good');
});

test('settled waits for what is still being written', async () => {
  const { files, kept } = disk(() => 10);
  void files.write('voice', 'one');
  void files.write('voice', 'two');
  await files.settled('voice');
  assert.equal(kept.get('voice'), 'two');
  await files.settled('nothing');
});
