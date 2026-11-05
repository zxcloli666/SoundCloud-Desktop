import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fetchWithAuthFallback, getSessionId } from './api-client';
import { busyRetrySec, sealedLoginBegin, sealedLoginPoll } from './chat/login';
import type { LoginStep, LoginTarget } from './chat/types';
import { API_BASE } from './constants';
import { describeError, logInfo } from './diagnostics';
import { edgeFetch } from './edge';

interface LoginRequest {
  url: string;
  loginRequestId: string;
  sealed: boolean;
}

interface LoginStatusResponse {
  status: 'pending' | 'completed' | 'failed' | 'expired';
  step?: LoginStep | null;
  sessionId?: string | null;
  username?: string | null;
  error?: string | null;
  redirectUrl?: string | null;
}

export interface OAuthFlowOptions {
  target?: LoginTarget;
  sealedOnly?: boolean;
}

export type OAuthStep = 'waiting' | LoginStep;
export type OAuthFlowError = {
  kind: 'failed' | 'expired' | 'unreachable' | 'limited';
  message: string;
  retryAfterSec?: number;
};

const POLL_INTERVAL_MS = 700;
const POLL_TIMEOUT_MS = 10_000;
const STALLED_POLL_MS = 5_000;
const UNREACHABLE_AFTER_MS = 15_000;
const CALLBACK_HINT_AFTER_MS = 60_000;
const LOGIN_TTL_MS = 15 * 60_000;
const NO_OPTIONS: OAuthFlowOptions = {};

export function useOAuthFlow(
  onSuccess: (sessionId: string) => void,
  onFailure?: (err: OAuthFlowError) => void,
  options: OAuthFlowOptions = NO_OPTIONS,
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
  const optionsRef = useRef(options);
  onSuccessRef.current = onSuccess;
  onFailureRef.current = onFailure;
  optionsRef.current = options;

  const cancel = useCallback(() => {
    attemptRef.current++;
    resumeRef.current = null;
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
    setAuthUrl(null);
    setError(null);
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

    let login: LoginRequest | null;
    try {
      login = await requestLogin(optionsRef.current);
    } catch (e) {
      if (!isStale()) fail(loginRequestError(e));
      return;
    }
    if (isStale()) return;
    if (!login) {
      fail({ kind: 'unreachable', message: 'Sealed login unavailable' });
      return;
    }
    const request = login;
    setAuthUrl(request.url);
    try {
      await openUrl(request.url);
    } catch (e) {
      logInfo(`[Auth] browser did not open the login page: ${describeError(e)}`);
      setBrowserFailed(true);
    }
    if (isStale()) return;

    const startedAt = Date.now();
    let failingSince: number | null = null;
    let lastRedirect: string | null = null;
    let stalled = false;
    let requesting = false;

    const schedule = (delayMs: number) => {
      pollRef.current = setTimeout(pollOnce, delayMs);
    };

    const pollOnce = async () => {
      if (Date.now() - startedAt > LOGIN_TTL_MS) {
        fail({ kind: 'expired', message: 'Login request expired' });
        return;
      }
      let data: LoginStatusResponse | null = null;
      requesting = true;
      try {
        data = await fetchLoginStatus(request);
      } catch {}
      requesting = false;
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
        onSuccessRef.current(data.sessionId);
        return;
      }
      if (data.status === 'completed' && request.sealed) {
        fail({ kind: 'failed', message: data.error ?? 'Login failed' });
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
      if (requesting) return;
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

async function requestLogin({
  target,
  sealedOnly,
}: OAuthFlowOptions): Promise<LoginRequest | null> {
  const sealed = await sealedLoginBegin(target ?? (getSessionId() ? 'current' : 'fresh'));
  if (sealed) return { ...sealed, sealed: true };
  if (sealedOnly) return null;
  const plain = await fetchWithAuthFallback<Omit<LoginRequest, 'sealed'>>('/auth/login', {
    silentStatuses: [429, 503],
  });
  return { url: plain.url, loginRequestId: plain.loginRequestId, sealed: false };
}

function loginRequestError(e: unknown): OAuthFlowError {
  const busySec = busyRetrySec(e);
  if (busySec !== null) {
    return { kind: 'limited', message: 'chat_busy', retryAfterSec: busySec };
  }
  if (e instanceof ApiError && (e.status === 429 || e.status === 503)) {
    return { kind: 'limited', message: e.body, retryAfterSec: e.retryAfterSeconds ?? undefined };
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

async function fetchLoginStatus(request: LoginRequest): Promise<LoginStatusResponse | null> {
  if (request.sealed) return sealedLoginPoll(request.loginRequestId);
  const res = await edgeFetch(
    `${API_BASE}/auth/login/status?id=${encodeURIComponent(request.loginRequestId)}`,
    { cache: 'no-store' },
    POLL_TIMEOUT_MS,
  );
  if (!res.ok) return null;
  return (await res.json()) as LoginStatusResponse;
}
