import { voiceIpc } from './ipc';
import { remoteApi } from './remote-api';
import type { RemoteCommand, RemoteState } from './remote-types';
import { reply } from './replies';
import { useVoiceRuntime } from './runtime';
import { useVoiceStore } from './store';

const FALLBACK_MS = 2_400;
const MAX_BACKOFF_MS = 30_000;

let generation = 0;
let running = false;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function failText(): string {
  return reply(useVoiceStore.getState().config.language, 'failed').speech;
}

export function settleRemote(id: string, ok: boolean, text: string, state: RemoteState) {
  const timer = pending.get(id);
  if (timer === undefined) return;
  clearTimeout(timer);
  pending.delete(id);
  void remoteApi.reply({ id, ok, text, state }).catch(() => {});
}

function feed(cmd: RemoteCommand) {
  if (pending.has(cmd.id)) return;
  pending.set(
    cmd.id,
    setTimeout(() => settleRemote(cmd.id, false, failText(), 'failed'), FALLBACK_MS),
  );
  voiceIpc
    .text(cmd.text, 'remote', cmd.id)
    .catch(() => settleRemote(cmd.id, false, failText(), 'failed'));
}

async function loop(gen: number) {
  let cursor = '';
  let failures = 0;
  while (gen === generation) {
    try {
      const wait = await remoteApi.wait(cursor);
      if (gen !== generation) return;
      cursor = wait.cursor;
      failures = 0;
      useVoiceRuntime.setState({ remote: 'live' });
      for (const cmd of wait.commands) feed(cmd);
    } catch {
      if (gen !== generation) return;
      failures++;
      useVoiceRuntime.setState({ remote: 'retrying' });
      await sleep(Math.min(1000 * 2 ** failures, MAX_BACKOFF_MS));
    }
  }
}

export function syncRemote(on: boolean) {
  if (on === running) return;
  running = on;
  generation++;
  useVoiceRuntime.setState({ remote: on ? 'live' : 'off' });
  if (on) void loop(generation);
}
