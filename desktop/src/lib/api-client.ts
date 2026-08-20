import { toast } from 'sonner';
import i18n from '../i18n';
import { useAppStatusStore } from '../stores/app-status';
import { useAuthStore } from '../stores/auth';
import { noteAuthGap, noteRateLimit, noteSuccess } from './auth-recovery';
import { API_BASE } from './constants';
import { logHttpError, logHttpFailure, trackAsync } from './diagnostics';
import { edgeFetch } from './edge';
import { withTimeout } from './request-timeout';
import {
  getHostVerdict,
  isIncidentActive,
  isTimeoutError,
  markHealthy,
  markUnhealthy,
  noteRequestTimeout,
} from './host-status';

let sessionId: string | null = null;
let sessionKnown = false;
let announceSessionKnown: () => void = () => {};
const sessionKnownPromise = new Promise<void>((resolve) => {
  announceSessionKnown = resolve;
});
const SESSION_WAIT_MS = 3_000;

export function setSessionId(id: string | null) {
  sessionId = id;
  if (!sessionKnown) {
    sessionKnown = true;
    announceSessionKnown();
  }
}

function awaitSessionKnown(): Promise<unknown> {
  if (sessionKnown) return Promise.resolve();
  return Promise.race([
    sessionKnownPromise,
    new Promise((resolve) => setTimeout(resolve, SESSION_WAIT_MS)),
  ]);
}

export function getSessionId() {
  return sessionId;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API ${status}: ${body}`);
    this.name = 'ApiError';
  }
}

function isRateLimitError(status: number, body: string): boolean {
  if (status === 429) return true;
  const normalized = body.toLowerCase();
  return (
    normalized.includes('rate limit') ||
    normalized.includes('rate-limited') ||
    normalized.includes('too many requests')
  );
}

function handleApiError(error: ApiError): void {
  if (error.status >= 500) {
    if (isIncidentActive()) return;
    toast.error(i18n.t('errors.serverError', { status: error.status }), {
      id: 'api-server-error',
    });
  } else if (error.status >= 400 && error.status !== 401) {
    try {
      const parsed = JSON.parse(error.body);
      toast.error(parsed.message || parsed.error || `Error ${error.status}`);
    } catch {
      toast.error(`Error ${error.status}`);
    }
  }
}

export type ApiRequestOptions = RequestInit & {
  silentStatuses?: number[];
};

const AUTH_TIMEOUT_MS = 20_000;
const DATA_PLANE_TIMEOUT_MS = 20_000;
const DOWN_HOST_TIMEOUT_MS = 6_000;
const RESPONSE_BODY_TIMEOUT_MS = 8_000;

function requestTimeout(path: string): number {
  return path.startsWith('/auth/') ? AUTH_TIMEOUT_MS : DATA_PLANE_TIMEOUT_MS;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
  timeoutMs?: number,
): Promise<T> {
  const { silentStatuses, ...init } = options;
  if (!sessionKnown) await awaitSessionKnown();

  const headers = new Headers(init.headers);
  const authenticated = !!sessionId && sessionId !== 'undefined' && sessionId !== 'null';
  if (authenticated) headers.set('x-session-id', sessionId as string);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');

  const method = init.method ?? 'GET';
  const label = `${method.toUpperCase()} ${path}`;
  const url = `${API_BASE}${path}`;
  const startedAt = performance.now();
  const effectiveTimeout = timeoutMs ?? requestTimeout(path);
  const attemptTimeout =
    getHostVerdict(API_BASE) === 'down'
      ? Math.min(effectiveTimeout, DOWN_HOST_TIMEOUT_MS)
      : effectiveTimeout;

  try {
    const response = await trackAsync(
      `http:${label}`,
      edgeFetch(url, { ...init, headers }, attemptTimeout),
    );

    if (response.status < 500) markHealthy(API_BASE);
    else markUnhealthy(API_BASE);
    useAppStatusStore.getState().setBackendReachable(true);

    if (!response.ok) {
      const body = await withTimeout(response.text(), RESPONSE_BODY_TIMEOUT_MS, `${label} body`);
      const error = new ApiError(response.status, body);
      if (silentStatuses?.includes(response.status)) throw error;

      logHttpError(label, response.status, url, body);
      if (isRateLimitError(response.status, body)) {
        noteRateLimit();
        console.error(`HTTP ERROR: url: ${path}, `, error);
        throw error;
      }

      const looksLikeAuthGap =
        response.status === 401 || (response.status < 500 && useAuthStore.getState().user == null);
      if (looksLikeAuthGap) {
        noteAuthGap();
        console.error(`HTTP ERROR: url: ${path}, `, error);
        throw error;
      }

      handleApiError(error);
      console.error(`HTTP ERROR: url: ${path}, `, error);
      throw error;
    }

    noteSuccess(authenticated);
    const contentType = response.headers.get('content-type');
    const reply: unknown = contentType?.includes('application/json')
      ? await withTimeout(response.json(), RESPONSE_BODY_TIMEOUT_MS, `${label} JSON body`)
      : await withTimeout(response.text(), RESPONSE_BODY_TIMEOUT_MS, `${label} text body`);

    if (typeof reply === 'string') {
      try {
        return JSON.parse(reply) as T;
      } catch {}
    }
    return reply as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Caller cancellation (track changed, view unmounted) is not a host failure
    // and must not poison edge health or trigger auth/network recovery.
    if (init.signal?.aborted) throw error;
    markUnhealthy(API_BASE);
    if (isTimeoutError(error)) noteRequestTimeout();
    logHttpFailure(label, url, error, performance.now() - startedAt);
    useAppStatusStore.getState().setBackendReachable(false);
    throw error;
  }
}

export const fetchWithAuthFallback = apiRequest;
