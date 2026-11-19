import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createMobileLink,
  type MobileLinkDeps,
  type StoredFlow,
} from '../src/lib/mobile-link/controller.ts';
import { LINK_TTL_MS } from '../src/lib/mobile-link/flow.ts';

const CALLBACK = { code: 'c1', state: 's1' };

function rig(over: Partial<MobileLinkDeps> = {}) {
  let now = 1_000_000;
  let stored: StoredFlow | null = null;
  let pending: typeof CALLBACK | null = null;
  let status: 'pending' | 'processing' | 'completed' = 'pending';
  let handler: ((c: typeof CALLBACK) => void) | null = null;
  const timers: Array<() => void> = [];
  const calls = {
    begin: 0,
    submit: [] as Array<[string, typeof CALLBACK]>,
    finished: [] as string[],
    opened: 0,
  };
  const deps: MobileLinkDeps = {
    begin: async () => {
      calls.begin++;
      return { id: 'link-1', url: 'https://sc/auth', account: { username: 'u', avatarUrl: null } };
    },
    submit: async (id, callback) => {
      calls.submit.push([id, callback]);
    },
    status: async () => status,
    open: async () => {
      calls.opened++;
    },
    parse: async () => null,
    takePending: async () => {
      const taken = pending;
      pending = null;
      return taken;
    },
    listen: (h) => {
      handler = h;
      return () => {};
    },
    load: async () => stored,
    save: async (flow) => {
      stored = flow;
    },
    clear: async () => {
      stored = null;
    },
    now: () => now,
    after: (_ms, run) => {
      timers.push(run);
      return () => {
        const i = timers.indexOf(run);
        if (i >= 0) timers.splice(i, 1);
      };
    },
    finished: (phase) => calls.finished.push(phase),
    log: () => {},
    ...over,
  };
  const link = createMobileLink(deps);
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const tick = async () => {
    const run = timers.shift();
    run?.();
    await settle();
  };
  return {
    link,
    calls,
    settle,
    tick,
    emit: (c: typeof CALLBACK) => handler?.(c),
    setStatus: (s: typeof status) => {
      status = s;
    },
    setPending: (c: typeof CALLBACK | null) => {
      pending = c;
    },
    setStored: (s: StoredFlow | null) => {
      stored = s;
    },
    getStored: () => stored,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}

test('the flow survives the dialog closing and takes the callback later', async () => {
  const r = rig();
  r.link.init();
  r.link.openDialog();
  await r.settle();
  assert.equal(r.link.store.getState().phase, 'waiting');

  r.link.closeDialog();
  const view = r.link.store.getState();
  assert.equal(view.active, true);
  assert.equal(view.phase, 'waiting');
  assert.equal(view.dialogOpen, false);

  r.emit(CALLBACK);
  await r.settle();
  assert.deepEqual(r.calls.submit, [['link-1', CALLBACK]]);
  assert.equal(r.link.store.getState().phase, 'received');

  r.setStatus('completed');
  await r.tick();
  assert.deepEqual(r.calls.finished, ['completed']);
  assert.equal(r.link.store.getState().active, false);
  assert.equal(r.getStored(), null);
});

test('reopening the dialog shows the same flow and does not begin another', async () => {
  const r = rig();
  r.link.openDialog();
  await r.settle();
  r.link.closeDialog();
  r.link.openDialog();
  await r.settle();
  assert.equal(r.calls.begin, 1);
  assert.equal(r.link.store.getState().phase, 'waiting');
  assert.equal(r.link.store.getState().dialogOpen, true);
});

test('a repeated callback is submitted once', async () => {
  const r = rig();
  r.link.init();
  r.link.openDialog();
  await r.settle();
  r.emit(CALLBACK);
  r.emit(CALLBACK);
  await r.settle();
  assert.equal(r.calls.submit.length, 1);
});

test('a callback with no flow is ignored', async () => {
  const r = rig();
  r.link.init();
  r.emit(CALLBACK);
  await r.settle();
  assert.equal(r.calls.submit.length, 0);
});

test('only the id and start time are stored, and a final phase clears them', async () => {
  const r = rig();
  r.link.openDialog();
  await r.settle();
  assert.deepEqual(r.getStored(), { id: 'link-1', startedAt: r.now() });
  r.setStatus('processing');
  r.advance(1000);
  await r.tick();
  assert.equal(r.link.store.getState().phase, 'received');
  r.advance(LINK_TTL_MS);
  await r.tick();
  assert.equal(r.link.store.getState().phase, 'expired');
  assert.equal(r.getStored(), null);
});

test('after a restart a stored flow resumes and submits the pending callback', async () => {
  const r = rig();
  r.setStored({ id: 'old-7', startedAt: r.now() - 5 * 60_000 });
  r.setPending(CALLBACK);
  r.link.init();
  await r.settle();
  assert.equal(r.calls.begin, 0);
  assert.deepEqual(r.calls.submit, [['old-7', CALLBACK]]);
  const view = r.link.store.getState();
  assert.equal(view.active, true);
  assert.equal(view.phase, 'received');
  assert.equal(view.minutes, 10);
});

test('after a restart with no pending callback the flow waits and keeps polling', async () => {
  const r = rig();
  r.setStored({ id: 'old-7', startedAt: r.now() - 60_000 });
  r.link.init();
  await r.settle();
  assert.equal(r.link.store.getState().phase, 'waiting');
  r.setStatus('completed');
  await r.tick();
  assert.deepEqual(r.calls.finished, ['completed']);
});

test('a stored flow past the time limit is dropped', async () => {
  const r = rig();
  r.setStored({ id: 'old-7', startedAt: r.now() - LINK_TTL_MS - 1 });
  r.setPending(CALLBACK);
  r.link.init();
  await r.settle();
  assert.equal(r.link.store.getState().active, false);
  assert.equal(r.getStored(), null);
  assert.equal(r.calls.submit.length, 0);
});

test('a stale pending callback is discarded when a new flow starts', async () => {
  const r = rig();
  r.setPending(CALLBACK);
  r.link.openDialog();
  await r.settle();
  assert.equal(r.calls.submit.length, 0);
  assert.equal(r.link.store.getState().phase, 'waiting');
});

test('a failed final phase with the dialog closed is announced and dismissed', async () => {
  const r = rig();
  r.link.openDialog();
  await r.settle();
  r.link.closeDialog();
  r.setStatus('processing');
  await r.tick();
  r.advance(LINK_TTL_MS + 1);
  await r.tick();
  assert.deepEqual(r.calls.finished, ['expired']);
  assert.equal(r.link.store.getState().active, false);
});
