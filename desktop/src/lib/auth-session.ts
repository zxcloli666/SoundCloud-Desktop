import { listen } from '@tauri-apps/api/event';
import { useAuthStore } from '../stores/auth';
import { useAuthRecoveryStore } from '../stores/auth-recovery';
import { setSessionId } from './api';
import { trackedInvoke as invoke } from './diagnostics';
import { queryClient } from './query-client';

interface ServerAuthState {
  token: string | null;
}

export function applyAuthFromServer(token: string | null): void {
  setSessionId(token);
  if (token) {
    useAuthStore.setState({ hasSession: true });
    return;
  }

  useAuthStore.setState({ hasSession: false, isAuthenticated: false, user: null });
  queryClient.clear();
  useAuthRecoveryStore.getState().reset();
}

const SNAPSHOT_ATTEMPTS = 3;
const SNAPSHOT_RETRY_MS = 300;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readAuthStatus(): Promise<ServerAuthState | null> {
  for (let attempt = 1; attempt <= SNAPSHOT_ATTEMPTS; attempt++) {
    try {
      return await invoke<ServerAuthState>('auth_status');
    } catch {
      if (attempt < SNAPSHOT_ATTEMPTS) await sleep(SNAPSHOT_RETRY_MS);
    }
  }
  return null;
}

export async function initAuthBridge(): Promise<void> {
  await listen<ServerAuthState>('auth:changed', (event) => {
    applyAuthFromServer(event.payload?.token ?? null);
  });
  const snapshot = await readAuthStatus();
  if (snapshot) applyAuthFromServer(snapshot.token ?? null);
}
