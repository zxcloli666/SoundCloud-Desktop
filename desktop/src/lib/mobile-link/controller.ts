import { createStore } from 'zustand/vanilla';
import type { AuthCallback, LinkAccount, LinkRequest, LinkStatus } from './api';
import {
  acceptsCallback,
  isFinal,
  LINK_TTL_MS,
  MAX_SUBMIT_TRIES,
  minutesLeft,
  type Phase,
  phaseOfStatus,
  pollDelay,
  reachedStep,
  type SubmitFailure,
  submitOutcome,
  wasSeen,
} from './flow.ts';

export interface StoredFlow {
  id: string;
  startedAt: number;
}

export interface MobileLinkDeps {
  begin: () => Promise<LinkRequest>;
  submit: (id: string, callback: AuthCallback) => Promise<void>;
  status: (id: string) => Promise<LinkStatus>;
  describe: (error: unknown) => SubmitFailure;
  open: (url: string) => Promise<void>;
  parse: (text: string) => Promise<AuthCallback | null>;
  takePending: () => Promise<AuthCallback | null>;
  listen: (handler: (callback: AuthCallback) => void) => () => void;
  load: () => Promise<StoredFlow | null>;
  save: (flow: StoredFlow) => Promise<void>;
  clear: () => Promise<void>;
  now: () => number;
  after: (ms: number, run: () => void) => () => void;
  finished: (phase: Phase, dialogOpen: boolean) => void;
  log: (message: string) => void;
}

export interface MobileLinkState {
  active: boolean;
  dialogOpen: boolean;
  phase: Phase;
  account: LinkAccount | null;
  step: number;
  minutes: number;
  canReopen: boolean;
  browserFailed: boolean;
  pasteInvalid: boolean;
}

const IDLE: MobileLinkState = {
  active: false,
  dialogOpen: false,
  phase: 'starting',
  account: null,
  step: 0,
  minutes: 0,
  canReopen: false,
  browserFailed: false,
  pasteInvalid: false,
};

interface Live {
  id: string;
  url: string | null;
  startedAt: number;
}

export function createMobileLink(deps: MobileLinkDeps) {
  const store = createStore<MobileLinkState>(() => IDLE);
  const seen = new Set<string>();
  let live: Live | null = null;
  let attempt = 0;
  let cancelTimer: (() => void) | null = null;
  let inited = false;

  const patch = (next: Partial<MobileLinkState>) => store.setState(next);
  const phase = () => store.getState().phase;

  function pausePolling() {
    cancelTimer?.();
    cancelTimer = null;
  }

  function reset() {
    attempt++;
    pausePolling();
    live = null;
    seen.clear();
  }

  function finish(next: Phase) {
    const { dialogOpen } = store.getState();
    patch({ phase: next, step: reachedStep(store.getState().step, next) });
    pausePolling();
    void deps.clear();
    deps.finished(next, dialogOpen);
    if (!dialogOpen) dismiss();
  }

  function move(next: Phase) {
    if (isFinal(next)) finish(next);
    else patch({ phase: next, step: reachedStep(store.getState().step, next) });
  }

  function dismiss() {
    reset();
    patch({ ...IDLE, dialogOpen: store.getState().dialogOpen });
  }

  function poll(forAttempt: number) {
    pausePolling();
    const tick = async () => {
      const link = live;
      if (forAttempt !== attempt || !link) return;
      const now = deps.now();
      if (now - link.startedAt > LINK_TTL_MS) {
        move('expired');
        return;
      }
      patch({ minutes: minutesLeft(link.startedAt, now) });
      try {
        const status = await deps.status(link.id);
        if (forAttempt !== attempt) return;
        const next = phaseOfStatus(phase(), status);
        if (next !== phase()) move(next);
      } catch {}
      if (forAttempt !== attempt || isFinal(phase())) return;
      cancelTimer = deps.after(pollDelay(phase()), tick);
    };
    cancelTimer = deps.after(pollDelay(phase()), tick);
  }

  function sleep(ms: number) {
    return new Promise<void>((resolve) => {
      deps.after(ms, resolve);
    });
  }

  async function submitWithRetry(link: Live, callback: AuthCallback, current: number) {
    for (let tries = 1; ; tries++) {
      try {
        await deps.submit(link.id, callback);
        return true;
      } catch (e) {
        if (current !== attempt) return false;
        const outcome = submitOutcome(deps.describe(e));
        const room = outcome.kind === 'retry' && tries < MAX_SUBMIT_TRIES;
        const inTime =
          outcome.kind === 'retry' && deps.now() + outcome.delayMs < link.startedAt + LINK_TTL_MS;
        if (outcome.kind === 'retry' && room && inTime) {
          await sleep(outcome.delayMs);
          if (current !== attempt) return false;
          continue;
        }
        deps.log(`[MobileLink] callback rejected: ${String(e)}`);
        move(outcome.kind === 'expired' ? 'expired' : 'failed');
        return false;
      }
    }
  }

  async function receive(callback: AuthCallback) {
    const link = live;
    if (!link || !acceptsCallback(phase())) return;
    if (wasSeen(seen, callback.state)) return;
    void deps.takePending();
    const current = attempt;
    move('received');
    pausePolling();
    const sent = await submitWithRetry(link, callback, current);
    if (!sent) return;
    if (current === attempt) poll(current);
  }

  async function start() {
    reset();
    const current = attempt;
    patch({ ...IDLE, active: true, dialogOpen: store.getState().dialogOpen });
    try {
      await deps.takePending();
      const link = await deps.begin();
      if (current !== attempt) return;
      const startedAt = deps.now();
      live = { id: link.id, url: link.url, startedAt };
      await deps.save({ id: link.id, startedAt });
      patch({
        phase: 'waiting',
        account: link.account,
        minutes: minutesLeft(startedAt, startedAt),
        canReopen: true,
      });
      deps.open(link.url).catch((e) => {
        deps.log(`[MobileLink] browser did not open: ${String(e)}`);
        if (current === attempt) patch({ browserFailed: true });
      });
      poll(current);
    } catch (e) {
      if (current !== attempt) return;
      deps.log(`[MobileLink] could not start: ${String(e)}`);
      move('failed');
    }
  }

  async function resume() {
    const stored = await deps.load();
    if (!stored || live) return;
    const now = deps.now();
    if (now - stored.startedAt > LINK_TTL_MS) {
      await deps.clear();
      return;
    }
    live = { id: stored.id, url: null, startedAt: stored.startedAt };
    patch({
      ...IDLE,
      active: true,
      dialogOpen: store.getState().dialogOpen,
      phase: 'waiting',
      minutes: minutesLeft(stored.startedAt, now),
    });
    const current = attempt;
    poll(current);
    const pending = await deps.takePending();
    if (pending && current === attempt) await receive(pending);
  }

  function init() {
    if (inited) return;
    inited = true;
    deps.listen((callback) => {
      void receive(callback);
    });
    void resume();
  }

  return {
    store,
    init,
    start,
    openDialog() {
      patch({ dialogOpen: true });
      if (!store.getState().active) void start();
    },
    closeDialog() {
      patch({ dialogOpen: false });
      if (isFinal(phase()) && store.getState().active) dismiss();
    },
    reopen() {
      const url = live?.url;
      if (!url) return;
      deps.open(url).catch(() => patch({ browserFailed: true }));
    },
    async paste(text: string) {
      const callback = await deps.parse(text);
      patch({ pasteInvalid: !callback });
      if (callback) await receive(callback);
    },
    clearPasteError() {
      patch({ pasteInvalid: false });
    },
  };
}

export type MobileLink = ReturnType<typeof createMobileLink>;
