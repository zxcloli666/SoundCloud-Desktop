import { netFetch } from '../net/fetch';

const EXTERNAL_TIMEOUT_MS = 10_000;

export function fetchExternal(url: string): Promise<Response> {
  return netFetch(url, { cache: 'no-store', timeoutMs: EXTERNAL_TIMEOUT_MS });
}
