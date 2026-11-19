import { listen } from '@tauri-apps/api/event';
import { trackedInvoke } from '../diagnostics';
import type { AuthCallback } from './api';

const EVENT = 'mobile-link:callback';

export function onAuthCallback(handler: (callback: AuthCallback) => void): () => void {
  let off: (() => void) | null = null;
  let closed = false;
  void listen<AuthCallback>(EVENT, (event) => handler(event.payload)).then((unlisten) => {
    if (closed) unlisten();
    else off = unlisten;
  });
  return () => {
    closed = true;
    off?.();
  };
}

export async function parseAuthAddress(text: string): Promise<AuthCallback | null> {
  try {
    return await trackedInvoke<AuthCallback>('deep_link_parse', { url: text });
  } catch {
    return null;
  }
}
