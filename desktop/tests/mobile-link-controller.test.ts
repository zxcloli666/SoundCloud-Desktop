import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createMobileLink,
  type MobileLinkDeps,
  type StoredFlow,
} from '../src/lib/mobile-link/controller.ts';
import { LINK_TTL_MS, type SubmitFailure, submitOutcome } from '../src/lib/mobile-link/flow.ts';

const CALLBACK = { code: 'c1', state: 's1' };

function failure(status: number, code: string, retryAfterSeconds: number | null = null) {
  return Object.assign(new Error(code), { status, code, retryAfterSeconds });
}

function rig(over: Partial<MobileLinkDeps> = {}, submitErrors: Error[] = []) {
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
      const next = submitErrors.shift();
      if (next) throw next;
    },
    status: async () => status,
    describe: (e) => e as SubmitFailure,
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

const NOT_REPLICATED = () => failure(503, 'mobile_link_not_replicated', 3);

async function sent(errors: Error[]) {
  const r = rig({}, errors);
  r.link.init();
  r.link.openDialog();
  await r.settle();
  r.emit(CALLBACK);
  await r.settle();
  return r;
}

test('a not replicated answer waits Retry-After and resubmits the same callback', async () => {
  const r = await sent([NOT_REPLICATED(), NOT_REPLICATED()]);
  assert.equal(r.calls.submit.length, 1);
  assert.equal(r.link.store.getState().phase, 'received');
  await r.tick();
  assert.equal(r.calls.submit.length, 2);
  await r.tick();
  assert.equal(r.calls.submit.length, 3);
  assert.deepEqual(r.calls.submit[2], ['link-1', CALLBACK]);
  assert.equal(r.link.store.getState().phase, 'received');
});

test('a rate limit answer is retried too', async () => {
  const r = await sent([failure(429, 'mobile_rate_limited')]);
  assert.equal(r.link.store.getState().phase, 'received');
  await r.tick();
  assert.equal(r.calls.submit.length, 2);
});

test('after five tries it fails', async () => {
  const r = await sent(Array.from({ length: 5 }, NOT_REPLICATED));
  for (let i = 0; i < 4; i++) await r.tick();
  assert.equal(r.calls.submit.length, 5);
  assert.equal(r.link.store.getState().phase, 'failed');
});

test('it stops retrying when the wait would pass the time limit', async () => {
  const r = rig({}, [NOT_REPLICATED()]);
  r.link.init();
  r.link.openDialog();
  await r.settle();
  r.advance(LINK_TTL_MS - 1000);
  r.emit(CALLBACK);
  await r.settle();
  assert.equal(r.calls.submit.length, 1);
  assert.equal(r.link.store.getState().phase, 'failed');
});

test('a 410 expired answer ends in expired', async () => {
  const r = await sent([failure(410, 'mobile_link_expired')]);
  assert.equal(r.calls.submit.length, 1);
  assert.deepEqual(r.calls.finished, ['expired']);
});

test('any other error fails at once', async () => {
  const r = await sent([failure(400, 'mobile_link_state')]);
  assert.equal(r.calls.submit.length, 1);
  assert.deepEqual(r.calls.finished, ['failed']);
});

test('outcomes follow the backend codes and default to two seconds', () => {
  assert.deepEqual(
    submitOutcome({ status: 503, code: 'mobile_link_not_replicated', retryAfterSeconds: null }),
    {
      kind: 'retry',
      delayMs: 2000,
    },
  );
  assert.deepEqual(
    submitOutcome({ status: 429, code: 'mobile_rate_limited', retryAfterSeconds: 7 }),
    {
      kind: 'retry',
      delayMs: 7000,
    },
  );
  assert.deepEqual(
    submitOutcome({ status: 410, code: 'mobile_link_expired', retryAfterSeconds: null }),
    {
      kind: 'expired',
    },
  );
  assert.deepEqual(submitOutcome({ status: 503, code: 'other', retryAfterSeconds: 2 }), {
    kind: 'failed',
  });
  assert.deepEqual(submitOutcome({ status: 0, code: null, retryAfterSeconds: null }), {
    kind: 'failed',
  });
});
