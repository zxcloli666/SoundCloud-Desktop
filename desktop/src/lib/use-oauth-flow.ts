import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fetchWithAuthFallback } from './api-client';
import { API_BASE } from './constants';
import { describeError, logInfo } from './diagnostics';
import { edgeFetch } from './edge';

interface LoginResponse {
  url: string;
  loginRequestId: string;
}

interface LoginStatusResponse {
  status: 'pending' | 'completed' | 'failed' | 'expired';
  step?: 'token' | 'extract' | 'finalizing';
  sessionId?: string;
  username?: string;
  error?: string;
  redirectUrl?: string;
}

export type OAuthStep = 'waiting' | 'token' | 'extract' | 'finalizing';
export type OAuthFlowError = {
  kind: 'failed' | 'expired' | 'unreachable' | 'limited';
  message: string;
  retryAfterSec?: number;
};

const POLL_INTERVAL_MS = 700;
const POLL_TIMEOUT_MS = 10_000;
const STALLED_POLL_MS = 5_000;
// Бэк может временно не отвечать (рестарт, сеть моргнула) — не вываливаем
// ошибку с первого промаха, но и не крутим спиннер вечно.
const UNREACHABLE_AFTER_MS = 15_000;
const CALLBACK_HINT_AFTER_MS = 60_000;
const LOGIN_TTL_MS = 15 * 60_000;

export function useOAuthFlow(
  onSuccess: (sessionId: string) => void,
  onFailure?: (err: OAuthFlowError) => void,
) {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [step, setStep] = useState<OAuthStep>('waiting');
  const [error, setError] = useState<OAuthFlowError | null>(null);
  const [browserFailed, setBrowserFailed] = useState(false);
  const [callbackSlow, setCallbackSlow] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const resumeRef = useRef<(() => void) | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onFailureRef = useRef(onFailure);
  onSuccessRef.current = onSuccess;
  onFailureRef.current = onFailure;

  const cancel = useCallback(() => {
    attemptRef.current++;
    resumeRef.current = null;
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
    setAuthUrl(null);
    setBrowserFailed(false);
    setCallbackSlow(false);
    setStep('waiting');
  }, []);

  useEffect(() => cancel, [cancel]);

  const fail = useCallback(
    (err: OAuthFlowError) => {
      logInfo(`[Auth] login ${err.kind}: ${err.message}`);
      cancel();
      setError(err);
      onFailureRef.current?.(err);
    },
    [cancel],
  );

  const startLogin = useCallback(async () => {
    cancel();
    const attempt = attemptRef.current;
    const isStale = () => attempt !== attemptRef.current;
    setError(null);
    setIsPolling(true);
    setStep('waiting');

    // x-session-id (если есть) автоматически уйдёт через apiRequest — тогда бэк
    // привяжет результат к существующей сессии и sessionId не сменится.
    let login: LoginResponse;
    try {
      login = await fetchWithAuthFallback<LoginResponse>('/auth/login', {
        silentStatuses: [429, 503],
      });
    } catch (e) {
      if (!isStale()) fail(loginRequestError(e));
      return;
    }
    if (isStale()) return;
    const { url, loginRequestId } = login;
    setAuthUrl(url);
    try {
      await openUrl(url);
    } catch (e) {
      logInfo(`[Auth] browser did not open the login page: ${describeError(e)}`);
      setBrowserFailed(true);
    }
    if (isStale()) return;

    const startedAt = Date.now();
    let failingSince: number | null = null;
    let lastRedirect: string | null = null;
    let stalled = false;

    const schedule = (delayMs: number) => {
      pollRef.current = setTimeout(pollOnce, delayMs);
    };

    const pollOnce = async () => {
      if (Date.now() - startedAt > LOGIN_TTL_MS) {
        fail({ kind: 'expired', message: 'Login request expired' });
        return;
      }
      let data: LoginStatusResponse | null = null;
      try {
        data = await fetchLoginStatus(loginRequestId);
      } catch {}
      if (isStale()) return;

      if (!data) {
        failingSince ??= Date.now();
        if (!stalled && Date.now() - failingSince >= UNREACHABLE_AFTER_MS) {
          stalled = true;
          logInfo('[Auth] login status unreachable, keep polling in background');
          setIsPolling(false);
          setError({ kind: 'unreachable', message: 'Backend unreachable' });
        }
        schedule(stalled ? STALLED_POLL_MS : POLL_INTERVAL_MS);
        return;
      }
      failingSince = null;

      if (data.status === 'completed' && data.sessionId) {
        cancel();
        setError(null);
        onSuccessRef.current(data.sessionId);
        return;
      }
      if (data.status === 'failed' || data.status === 'expired') {
        fail({ kind: data.status, message: data.error ?? 'Login failed' });
        return;
      }

      if (data.redirectUrl && data.redirectUrl !== lastRedirect) {
        lastRedirect = data.redirectUrl;
        setAuthUrl(data.redirectUrl);
        setStep('waiting');
      } else if (!stalled) {
        if (data.step) setStep(data.step);
        setCallbackSlow(!data.step && Date.now() - startedAt >= CALLBACK_HINT_AFTER_MS);
      }
      schedule(stalled ? STALLED_POLL_MS : POLL_INTERVAL_MS);
    };

    resumeRef.current = () => {
      stalled = false;
      failingSince = null;
      setError(null);
      setIsPolling(true);
      if (pollRef.current) clearTimeout(pollRef.current);
      schedule(0);
    };
    schedule(POLL_INTERVAL_MS);
  }, [cancel, fail]);

  const retry = useCallback(() => {
    if (resumeRef.current) resumeRef.current();
    else void startLogin();
  }, [startLogin]);

  const reopen = useCallback(() => {
    if (!authUrl) return;
    openUrl(authUrl).catch((e) => {
      logInfo(`[Auth] browser did not reopen the login page: ${describeError(e)}`);
      setBrowserFailed(true);
    });
  }, [authUrl]);

  return {
    startLogin,
    retry,
    reopen,
    authUrl,
    isPolling,
    step,
    cancel,
    error,
    browserFailed,
    callbackSlow,
  };
}

function loginRequestError(e: unknown): OAuthFlowError {
  if (e instanceof ApiError && (e.status === 429 || e.status === 503)) {
    return { kind: 'limited', message: e.body, retryAfterSec: e.retryAfterSec };
  }
  if (!(e instanceof ApiError) || e.status >= 500) {
    return { kind: 'unreachable', message: e instanceof Error ? e.message : 'Backend unreachable' };
  }
  let message = `HTTP ${e.status}`;
  try {
    message = JSON.parse(e.body).message || message;
  } catch {}
  return { kind: 'failed', message };
}

async function fetchLoginStatus(loginRequestId: string): Promise<LoginStatusResponse | null> {
  const res = await edgeFetch(
    `${API_BASE}/auth/login/status?id=${encodeURIComponent(loginRequestId)}`,
    { cache: 'no-store' },
    POLL_TIMEOUT_MS,
  );
  if (!res.ok) return null;
  return (await res.json()) as LoginStatusResponse;
}
