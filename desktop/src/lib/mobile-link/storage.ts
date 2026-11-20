import { tauriStorage } from '../tauri-storage';
import type { StoredFlow } from './controller.ts';

const KEY = 'sc-mobile-link';

export async function loadFlow(): Promise<StoredFlow | null> {
  try {
    const raw = await tauriStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (typeof parsed?.id !== 'string' || typeof parsed?.startedAt !== 'number') return null;
    return { id: parsed.id, startedAt: parsed.startedAt };
  } catch {
    return null;
  }
}

export async function saveFlow(flow: StoredFlow): Promise<void> {
  const { id, startedAt } = flow;
  await tauriStorage.setItem(KEY, JSON.stringify({ id, startedAt }));
}

export async function clearFlow(): Promise<void> {
  await tauriStorage.removeItem(KEY);
}
