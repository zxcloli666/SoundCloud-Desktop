import { fetch } from '@tauri-apps/plugin-http';

const EXTERNAL_TIMEOUT_MS = 3_000;

export async function fetchExternal(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
