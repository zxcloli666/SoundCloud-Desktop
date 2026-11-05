import { trackedInvoke as invoke } from '../diagnostics';
import { parseSentinel, type Sentinel, sentinelText } from './crash-guard';

const ALIVE_EVERY_MS = 2_000;
const PAGE = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) =>
  byte.toString(16).padStart(2, '0'),
).join('');

let written: string | null = null;
let aliveTimer: ReturnType<typeof setInterval> | undefined;

export async function writeSentinel(id: string, hash: string): Promise<void> {
  clearInterval(aliveTimer);
  await invoke('theme_alive', { alive: false }).catch(() => undefined);
  const text = sentinelText(id, hash, PAGE);
  await invoke('theme_sentinel_write', { text }).catch(() => undefined);
  written = text;
  aliveTimer = setInterval(() => {
    void invoke('theme_alive', { alive: true }).catch(() => undefined);
  }, ALIVE_EVERY_MS);
}

export async function readSentinel(): Promise<Sentinel | null> {
  return parseSentinel(await invoke<string>('theme_sentinel_read').catch(() => ''));
}

export async function markReload(): Promise<void> {
  if (!written) return;
  clearInterval(aliveTimer);
  await invoke<boolean>('theme_mark_reload', { expected: written });
}

export async function clearSentinel(): Promise<void> {
  const expected = written;
  written = null;
  clearInterval(aliveTimer);
  await invoke<boolean>('theme_sentinel_clear', { expected }).catch(() => undefined);
}

export function sentinelHolds(id: string, hash: string): boolean {
  return written === sentinelText(id, hash, PAGE);
}
