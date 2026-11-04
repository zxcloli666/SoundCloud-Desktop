import { BaseDirectory, mkdir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import { trackedInvoke as invoke } from '../diagnostics';
import { parseSentinel, reloadText, type Sentinel, sentinelText } from './crash-guard';

const SENTINEL_PATH = 'themes/applying';
const APP_DATA = { baseDir: BaseDirectory.AppData };
const ALIVE_EVERY_MS = 2_000;

let written: string | null = null;
let aliveTimer: ReturnType<typeof setInterval> | undefined;

export async function writeSentinel(id: string, hash: string): Promise<void> {
  clearInterval(aliveTimer);
  await invoke('theme_alive', { alive: false }).catch(() => undefined);
  await mkdir('themes', { ...APP_DATA, recursive: true }).catch(() => undefined);
  await writeTextFile(SENTINEL_PATH, sentinelText(id, hash), APP_DATA).catch(() => undefined);
  written = sentinelText(id, hash);
  aliveTimer = setInterval(() => {
    void invoke('theme_alive', { alive: true }).catch(() => undefined);
  }, ALIVE_EVERY_MS);
}

export async function readSentinel(): Promise<Sentinel | null> {
  return parseSentinel(await readTextFile(SENTINEL_PATH, APP_DATA).catch(() => ''));
}

export async function markReload(): Promise<void> {
  const text = written ? reloadText(written) : null;
  if (!text) return;
  clearInterval(aliveTimer);
  await writeTextFile(SENTINEL_PATH, text, APP_DATA);
}

export async function clearSentinel(): Promise<void> {
  written = null;
  clearInterval(aliveTimer);
  await remove(SENTINEL_PATH, APP_DATA).catch(() => undefined);
}

export function sentinelHolds(id: string, hash: string): boolean {
  return written === `${id} ${hash}`;
}
