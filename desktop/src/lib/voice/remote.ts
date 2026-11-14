import { usePlayerStore } from '../../stores/player';
import { ApiError } from '../api';
import { trackedInvoke as invoke } from '../diagnostics';
import { ACTIVITY_EVENTS } from '../idle';
import { queryClient } from '../query-client';
import { voiceIpc } from './ipc';
import { REMOTE_LINKS_KEY, remoteApi } from './remote-api';
import type { RemoteCommand, RemoteState, SpeakerProvider } from './remote-types';
import { reply } from './replies';
import { useVoiceRuntime } from './runtime';
import { useVoiceStore } from './store';

const FALLBACK_MS = 2_400;
const MAX_BACKOFF_MS = 30_000;
const MAX_RETRY_AFTER_MS = 60_000;
const SEEN_MS = 10 * 60_000;
const PROVIDERS: SpeakerProvider[] = ['alice', 'salut'];

let generation = 0;
let running = false;
let device: Promise<string> | null = null;
let activeAt = Date.now();
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const seen = new Map<string, number>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfter(err: unknown): number {
  if (!(err instanceof ApiError) || err.status !== 429) return 0;
  return Math.min((err.retryAfterSeconds ?? 0) * 1000, MAX_RETRY_AFTER_MS);
}

function deviceId(): Promise<string> {
  device ??= invoke<string>('call_device_id').catch(() => {
    device = null;
    return '';
  });
  return device;
}

export function markActive() {
  activeAt = Date.now();
}

function active(): number {
  return usePlayerStore.getState().isPlaying ? Date.now() : activeAt;
}

function watchActivity(on: boolean) {
  for (const event of ACTIVITY_EVENTS) {
    if (on) window.addEventListener(event, markActive, { passive: true });
    else window.removeEventListener(event, markActive);
  }
}

export function settleRemote(
  id: string,
  ok: boolean,
  speech: string,
  display: string,
  state: RemoteState,
): Promise<void> {
  const timer = pending.get(id);
  if (timer === undefined) return Promise.resolve();
  clearTimeout(timer);
  pending.delete(id);
  return remoteApi.reply({ id, ok, speech, display, state }).catch(() => {});
}

function fail(id: string) {
  const failed = reply(useVoiceStore.getState().config.language, 'failed');
  void settleRemote(id, false, failed.speech, failed.display, 'failed');
}

export function answerLink(id: string, ok: boolean) {
  const runtime = useVoiceRuntime.getState();
  if (runtime.linkAsk?.id === id) useVoiceRuntime.setState({ linkAsk: null });
  if (runtime.hud.kind === 'link_confirm' && runtime.hud.id === id) runtime.hideHud();
  void settleRemote(id, ok, '', '', ok ? 'done' : 'failed').then(() => {
    if (ok) void queryClient.invalidateQueries({ queryKey: REMOTE_LINKS_KEY });
  });
}

function askLink(cmd: RemoteCommand) {
  const provider = cmd.provider ?? PROVIDERS.find((p) => p === cmd.source);
  const left = cmd.expiresAt - Date.now();
  if (!provider || left <= 0) return;
  const previous = useVoiceRuntime.getState().linkAsk;
  if (previous) answerLink(previous.id, false);
  pending.set(
    cmd.id,
    setTimeout(() => answerLink(cmd.id, false), left),
  );
  const ask = { id: cmd.id, provider, expiresAt: cmd.expiresAt, hint: cmd.hint };
  useVoiceRuntime.setState({ linkAsk: ask });
  useVoiceRuntime.getState().setHud({ kind: 'link_confirm', id: cmd.id, provider, hint: cmd.hint });
}

function firstSight(id: string): boolean {
  const now = Date.now();
  for (const [key, at] of seen) {
    if (now - at <= SEEN_MS) break;
    seen.delete(key);
  }
  if (seen.has(id)) return false;
  seen.set(id, now);
  return true;
}

function feed(cmd: RemoteCommand) {
  if (!firstSight(cmd.id)) return;
  if (cmd.kind === 'link_confirm') return askLink(cmd);
  pending.set(
    cmd.id,
    setTimeout(() => fail(cmd.id), FALLBACK_MS),
  );
  voiceIpc.text(cmd.text, 'remote', cmd.id).catch(() => fail(cmd.id));
}

async function loop(gen: number) {
  let cursor: number | null = null;
  let failures = 0;
  while (gen === generation) {
    try {
      const wait = await remoteApi.wait(cursor, await deviceId(), active());
      if (gen !== generation) return;
      cursor = wait.cursor;
      failures = 0;
      useVoiceRuntime.setState({ remote: 'live' });
      for (const cmd of wait.commands) feed(cmd);
    } catch (err) {
      if (gen !== generation) return;
      failures++;
      useVoiceRuntime.setState({ remote: 'retrying' });
      await sleep(Math.max(retryAfter(err), Math.min(1000 * 2 ** failures, MAX_BACKOFF_MS)));
    }
  }
}

export function syncRemote(on: boolean) {
  if (on === running) return;
  running = on;
  generation++;
  watchActivity(on);
  const asked = useVoiceRuntime.getState().linkAsk;
  if (!on && asked) answerLink(asked.id, false);
  useVoiceRuntime.setState({ remote: on ? 'live' : 'off' });
  if (on) void loop(generation);
}
