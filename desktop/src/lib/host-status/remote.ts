import { trackedInvoke as invoke } from '../diagnostics';
import type { RemoteVerdict } from './store';

const REMOTE_CACHE_MS = 30_000;

type Roles = Record<string, unknown>;

let cached: { roles: Roles | null; at: number } | null = null;

function verdictOf(role: unknown): RemoteVerdict {
  if (role === 'operational' || role === 'degraded') return 'up';
  if (role === 'down') return 'down';
  return 'unknown';
}

async function load(): Promise<Roles | null> {
  try {
    const payload = await invoke<{ roles?: unknown } | null>('net_status_verdict');
    const roles = payload?.roles;
    return typeof roles === 'object' && roles !== null ? (roles as Roles) : null;
  } catch {
    return null;
  }
}

async function fetchRoles(): Promise<Roles | null> {
  if (cached && Date.now() - cached.at < REMOTE_CACHE_MS) return cached.roles;
  const roles = await load();
  cached = { roles, at: Date.now() };
  return roles;
}

export async function fetchRemoteVerdict(): Promise<RemoteVerdict> {
  return verdictOf((await fetchRoles())?.main);
}

export async function playbackServersDown(): Promise<boolean> {
  const roles = await fetchRoles();
  const playback = roles?.playback;
  return playback === 'degraded' || playback === 'down' || verdictOf(roles?.main) === 'down';
}
