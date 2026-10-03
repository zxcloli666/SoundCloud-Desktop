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
// Бэк может временно не отвечать (рестарт, сеть моргнула) — не вываливаем
// ошибку с первого промаха, но и не крутим спиннер вечно.
const UNREACHABLE_AFTER_MS = 15_000;

export function useOAuthFlow(
  onSuccess: (sessionId: string) => void,
  onFailure?: (err: OAuthFlowError) => void,
) {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [step, setStep] = useState<OAuthStep>('waiting');
  const [error, setError] = useState<OAuthFlowError | null>(null);
  const [browserFailed, setBrowserFailed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const onSuccessRef = useRef(onSuccess);
  const onFailureRef = useRef(onFailure);
  onSuccessRef.current = onSuccess;
  onFailureRef.current = onFailure;

  const cancel = useCallback(() => {
    attemptRef.current++;
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
    setAuthUrl(null);
    setBrowserFailed(false);
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

    let failingSince: number | null = null;
    let lastRedirect: string | null = null;

    const tryPoll = async (base: string): Promise<LoginStatusResponse | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        const res = await edgeFetch(
          `${base}/auth/login/status?id=${encodeURIComponent(loginRequestId)}`,
          { signal: controller.signal, cache: 'no-store' as RequestCache },
        );
        if (!res.ok) return null;
        return (await res.json()) as LoginStatusResponse;
      } finally {
        clearTimeout(timer);
      }
    };

    const pollOnce = async () => {
      let data: LoginStatusResponse | null = null;
      try {
        data = await tryPoll(API_BASE);
      } catch {}
      if (isStale()) return;

      if (!data) {
        const now = Date.now();
        if (failingSince == null) failingSince = now;
        if (now - failingSince >= UNREACHABLE_AFTER_MS) {
          fail({ kind: 'unreachable', message: 'Backend unreachable' });
          return;
        }
        pollRef.current = setTimeout(pollOnce, POLL_INTERVAL_MS);
        return;
      }
      failingSince = null;

      if (data.redirectUrl && data.redirectUrl !== lastRedirect) {
        lastRedirect = data.redirectUrl;
        setStep('waiting');
        pollRef.current = setTimeout(pollOnce, POLL_INTERVAL_MS);
        return;
      }

      if (data.step) setStep(data.step);

      if (data.status === 'completed' && data.sessionId) {
        cancel();
        onSuccessRef.current(data.sessionId);
        return;
      }
      if (data.status === 'failed' || data.status === 'expired') {
        fail({ kind: data.status, message: data.error ?? 'Login failed' });
        return;
      }
      pollRef.current = setTimeout(pollOnce, POLL_INTERVAL_MS);
    };

    pollRef.current = setTimeout(pollOnce, POLL_INTERVAL_MS);
  }, [cancel, fail]);

  return { startLogin, authUrl, isPolling, step, cancel, error, browserFailed };
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
