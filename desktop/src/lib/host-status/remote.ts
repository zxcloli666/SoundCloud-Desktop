import { STATUS_PAGE_URL } from '../constants';
import { fetchExternal } from './external';
import type { RemoteVerdict } from './store';

const REMOTE_CACHE_MS = 30_000;

interface VerdictPayload {
  roles?: Record<string, unknown>;
}

let cached: { verdict: RemoteVerdict; at: number } | null = null;

export function parseRemoteVerdict(payload: unknown): RemoteVerdict {
  if (typeof payload !== 'object' || payload === null) return 'unknown';
  const main = (payload as VerdictPayload).roles?.main;
  if (main === 'operational' || main === 'degraded') return 'up';
  if (main === 'down') return 'down';
  return 'unknown';
}

async function load(): Promise<RemoteVerdict> {
  try {
    const res = await fetchExternal(`${STATUS_PAGE_URL}/api/verdict`);
    if (!res.ok) return 'unknown';
    return parseRemoteVerdict(await res.json());
  } catch {
    return 'unknown';
  }
}

export async function fetchRemoteVerdict(): Promise<RemoteVerdict> {
  if (cached && Date.now() - cached.at < REMOTE_CACHE_MS) return cached.verdict;
  const verdict = await load();
  cached = { verdict, at: Date.now() };
  return verdict;
}
