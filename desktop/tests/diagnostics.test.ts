import assert from 'node:assert/strict';
import { test } from 'node:test';

interface Line {
  level: string;
  message: string;
}

const lines: Line[] = [];
const invoke = async (_command: string, line: Line) => {
  lines.push(line);
};
Object.assign(globalThis, { window: globalThis, __TAURI_INTERNALS__: { invoke } });
console.info = () => {};
console.error = () => {};

const { trackAsync } = await import('../src/lib/diagnostics.ts');

async function logged(reason: unknown): Promise<Line[]> {
  lines.length = 0;
  await assert.rejects(trackAsync('invoke:voice_chat', Promise.reject(reason)), (thrown) => {
    assert.equal(thrown, reason);
    return true;
  });
  return [...lines];
}

test('a rejection that carries a code is logged at info level with its code', async () => {
  const [line, ...rest] = await logged({ code: 'network' });
  assert.equal(rest.length, 0);
  assert.equal(line.level, 'INFO');
  assert.match(line.message, /^\[Perf\] Task refused: invoke:voice_chat \(after \d+ms\): network$/);
});

test('a failure without a code is an error with its real content', async () => {
  const cases: [unknown, string][] = [
    ['no session', 'no session'],
    [{ message: 'no route' }, 'no route'],
    [{ status: 502, hop: 'relay' }, '{"status":502,"hop":"relay"}'],
    [{ code: 7 }, '{"code":7}'],
    [null, 'null'],
    [new Error('engine is gone'), 'engine is gone'],
    [Object.assign(new Error('no such file'), { code: 'ENOENT' }), 'no such file'],
  ];
  for (const [reason, text] of cases) {
    const [line, ...rest] = await logged(reason);
    assert.equal(rest.length, 0);
    assert.equal(line.level, 'ERROR');
    assert.equal(
      line.message.replace(/after \d+ms/, 'after Nms'),
      `[Perf] Task failed: invoke:voice_chat (after Nms): ${text}`,
    );
    assert.doesNotMatch(line.message, /\[object Object\]/);
  }
});
