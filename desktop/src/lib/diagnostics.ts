import { type InvokeArgs, type InvokeOptions, invoke as coreInvoke } from '@tauri-apps/api/core';

const EVENT_LOOP_TICK_MS = 1000;
const EVENT_LOOP_WARN_MS = 500;
const INVOKE_WARN_MS = 1500;
const ASYNC_WARN_MS = 2500;

const DUPLICATE_WINDOW_MS = 5000;
const NOISE = /ResizeObserver loop/;
const FLUSH_AT = 10;

let watchdogStarted = false;
const lastReported = new Map<string, number>();
let flushNow: (() => void) | null = null;

export type DiagKind = 'render' | 'unhandled' | 'rejection' | 'playback' | 'request';

function roundMs(value: number) {
  return Math.round(value);
}

function writeLog(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
  void coreInvoke('diagnostics_log', { level, message }).catch(() => undefined);
}

export function logInfo(message: string) {
  console.info(message);
  writeLog('INFO', message);
}

function logWarn(message: string) {
  console.warn(message);
  writeLog('WARN', message);
}

export function logError(message: string) {
  console.error(message);
  writeLog('ERROR', message);
}

export function newTraceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function onDiagQueueFull(flush: () => void) {
  flushNow = flush;
}

export function reportError(
  kind: DiagKind,
  error: unknown,
  details: { context?: Record<string, string>; trace?: string; componentStack?: string | null } = {},
) {
  const failure = error instanceof Error ? error : new Error(String(error));
  if (NOISE.test(failure.message)) return;
  const key = `${kind}|${failure.message}`;
  const now = Date.now();
  if (now - (lastReported.get(key) ?? 0) < DUPLICATE_WINDOW_MS) return;
  lastReported.set(key, now);
  const report = {
    kind,
    message: failure.message,
    stack: failure.stack ?? null,
    component_stack: details.componentStack ?? null,
    trace: details.trace ?? null,
    context: { route: `${location.pathname}${location.search}`, ...details.context },
  };
  coreInvoke<number>('diag_error', { error: report })
    .then((queued) => {
      if (queued >= FLUSH_AT) flushNow?.();
    })
    .catch(() => undefined);
}

export function reportRequestFailure(
  service: 'api' | 'stream',
  path: string,
  error: unknown,
  trace: string,
) {
  reportError('request', error, {
    context: {
      service,
      path: path.split('?')[0],
      class: error instanceof Error ? error.name : 'unknown',
    },
    trace,
  });
}

export function setupUiWatchdog() {
  if (watchdogStarted) return;
  watchdogStarted = true;

  logInfo('[Perf] UI watchdog started');

  let expectedAt = performance.now() + EVENT_LOOP_TICK_MS;
  window.setInterval(() => {
    const now = performance.now();
    const lag = now - expectedAt;
    expectedAt = now + EVENT_LOOP_TICK_MS;

    if (document.visibilityState === 'visible' && lag > EVENT_LOOP_WARN_MS) {
      logWarn(`[Perf] UI event loop lag detected: ${roundMs(lag)}ms`);
    }
  }, EVENT_LOOP_TICK_MS);

  document.addEventListener('visibilitychange', () => {
    expectedAt = performance.now() + EVENT_LOOP_TICK_MS;
  });

  window.addEventListener('error', (event) => {
    logError(`[UI] Unhandled error: ${event.message}`);
    reportError('unhandled', event.error ?? event.message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError(`[UI] Unhandled rejection: ${String(event.reason)}`);
    reportError('rejection', event.reason);
  });
}

function truncate(value: string, max = 500) {
  return value.length > max ? `${value.slice(0, max)}...[+${value.length - max}]` : value;
}

// Транспортные ошибки (@tauri-apps/plugin-http → reqwest) приходят одним
// плоским Error: верхний Display вида "error sending request for url (...)",
// а реальная причина (timeout / dns / connection refused / tcp connect)
// спрятана в source()-цепочке, которую плагин частично прокидывает в .cause.
// String(error) её теряет — поэтому разворачиваем имя + всю cause-цепочку.
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return truncate(String(error));

  const parts: string[] = [];
  let cur: unknown = error;
  const seen = new Set<unknown>();
  while (cur instanceof Error && !seen.has(cur)) {
    seen.add(cur);
    const name = cur.name && cur.name !== 'Error' ? `${cur.name}: ` : '';
    parts.push(`${name}${cur.message || '(no message)'}`);
    cur = (cur as { cause?: unknown }).cause;
  }
  if (cur != null && !(cur instanceof Error)) parts.push(String(cur));

  // AbortError = сработал наш клиентский таймаут (см. fetchWithTimeout),
  // а не отказ сети. Это меняет диагноз, поэтому помечаем явно.
  if (error.name === 'AbortError') parts.push('(client-timeout: our AbortController fired)');

  return truncate(parts.join(' -> '));
}

export function logHttpError(
  label: string,
  status: number,
  url: string,
  body?: string,
  error?: unknown,
) {
  const parts = [`[Perf] HTTP ${status} ${label} ${url}`];
  if (body) parts.push(`body=${truncate(body)}`);
  if (error !== undefined) parts.push(`error=${describeError(error)}`);
  logError(parts.join(' | '));
}

export function logHttpFailure(label: string, url: string, error: unknown, elapsedMs?: number) {
  const parts = [`[Perf] HTTP FAIL ${label} ${url}`];
  if (elapsedMs !== undefined) parts.push(`after=${roundMs(elapsedMs)}ms`);
  parts.push(`error=${describeError(error)}`);
  logError(parts.join(' | '));
}

export async function trackAsync<T>(
  label: string,
  promise: Promise<T>,
  warnMs = ASYNC_WARN_MS,
): Promise<T> {
  const startedAt = performance.now();
  const slowTimer = window.setTimeout(() => {
    logWarn(`[Perf] Slow task still running: ${label} (${warnMs}ms+)`);
  }, warnMs);

  try {
    return await promise;
  } catch (error) {
    const elapsed = performance.now() - startedAt;
    logError(`[Perf] Task failed: ${label} (after ${roundMs(elapsed)}ms): ${describeError(error)}`);
    throw error;
  } finally {
    window.clearTimeout(slowTimer);
    const elapsed = performance.now() - startedAt;
    if (elapsed > warnMs) {
      logWarn(`[Perf] Slow task finished: ${label} (${roundMs(elapsed)}ms)`);
    }
  }
}

export function trackedInvoke<T>(
  command: string,
  args?: InvokeArgs,
  warnMs = INVOKE_WARN_MS,
  options?: InvokeOptions,
): Promise<T> {
  return trackAsync(`invoke:${command}`, coreInvoke<T>(command, args, options), warnMs);
}
