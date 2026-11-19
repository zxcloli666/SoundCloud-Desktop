import { listen } from '@tauri-apps/api/event';
import { useAuthStore } from '../stores/auth';
import { useAuthRecoveryStore } from '../stores/auth-recovery';
import { cancelPendingDeletes } from '../stores/comment-delete';
import { setSessionId } from './api';
import { forgetCommentLikes } from './comment-likes';
import { trackedInvoke as invoke } from './diagnostics';
import { forgetMoments } from './moment-reactions';
import { setIsPremium } from './premium-cache';
import { queryClient } from './query-client';

interface ServerAuthState {
  token: string | null;
  premium?: boolean;
}

/**
 * Apply Rust-owned session state to the frontend mirrors. The api-client token
 * mirror and the auth store are written ONLY here — always with a value Rust
 * just confirmed (command return or the `auth:changed` broadcast). Premium
 * mirror: `undefined` leaves it untouched (caller without the flag), token=null
 * clears it. Idempotent, so the initiating window and the tray can both run it.
 */
export function applyAuthFromServer(token: string | null, premium?: boolean): void {
  setSessionId(token);
  if (token) {
    if (premium !== undefined) setIsPremium(premium);
    useAuthStore.setState({ hasSession: true });
  } else {
    setIsPremium(false);
    useAuthStore.setState({ hasSession: false, isAuthenticated: false, user: null });
    queryClient.clear();
    forgetCommentLikes();
    forgetMoments();
    cancelPendingDeletes();
    useAuthRecoveryStore.getState().reset();
  }
}

const SNAPSHOT_ATTEMPTS = 3;
const SNAPSHOT_RETRY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Снимок сессии из Rust. Провал invoke — это НЕ «юзер разлогинен», а «Rust не
 * ответил», и путать их нельзя: в dev webview перезагружается отдельно от
 * бэкенда, висящий callback теряется (`[TAURI] Couldn't find callback id`), и
 * ошибка прилетает на ровном месте. Раньше её принимали за пустую сессию —
 * зеркало чистилось, и первые запросы уходили без `x-session-id`, ловя
 * бессмысленный 401 «Missing or malformed». Поэтому: ретраим, а не отвечаем.
 */
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

/** Seed the mirror from Rust once, then track every `auth:changed` broadcast. */
export async function initAuthBridge(): Promise<void> {
  // Подписка ПЕРЕД снимком: логин/логаут, случившийся пока читаем снимок,
  // иначе потерялся бы целиком.
  await listen<ServerAuthState>('auth:changed', (e) => {
    applyAuthFromServer(e.payload?.token ?? null, e.payload?.premium);
  });
  const snap = await readAuthStatus();
  // Rust так и не ответил — зеркало не трогаем. Пусть его заполнит
  // `auth:changed`, а запросы подождут (`api-client`: гейт с потолком).
  if (snap) applyAuthFromServer(snap.token ?? null, snap.premium);
}
