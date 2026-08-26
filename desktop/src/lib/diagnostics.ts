import { invoke as coreInvoke } from '@tauri-apps/api/core';

const EVENT_LOOP_TICK_MS = 1000;
const EVENT_LOOP_WARN_MS = 500;
const INVOKE_WARN_MS = 1500;
const ASYNC_WARN_MS = 2500;

let watchdogStarted = false;
const LOG_BATCH_DELAY_MS = 750;
const LOG_BATCH_CAP = 80;

interface DiagnosticLogEntry {
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

let pendingLogs: DiagnosticLogEntry[] = [];
let logFlushTimer: ReturnType<typeof setTimeout> | null = null;
let logFlushChain: Promise<void> = Promise.resolve();

function roundMs(value: number) {
  return Math.round(value);
}

function flushLogs() {
  if (logFlushTimer) {
    clearTimeout(logFlushTimer);
    logFlushTimer = null;
  }
  if (pendingLogs.length === 0) return;
  const entries = pendingLogs;
  pendingLogs = [];
  logFlushChain = logFlushChain
    .catch(() => undefined)
    .then(() => coreInvoke('diagnostics_log_batch', { entries }))
    .then(
      () => undefined,
      () => undefined,
    );
}

function writeLog(level: DiagnosticLogEntry['level'], message: string) {
  pendingLogs.push({ level, message });
  if (pendingLogs.length >= LOG_BATCH_CAP) {
    flushLogs();
    return;
  }
  if (!logFlushTimer) logFlushTimer = setTimeout(flushLogs, LOG_BATCH_DELAY_MS);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushLogs();
  });
  window.addEventListener('beforeunload', flushLogs);
}

export function logInfo(message: string) {
  console.info(message);
  writeLog('INFO', message);
}

function logWarn(message: string) {
  console.warn(message);
  writeLog('WARN', message);
}

function logError(message: string) {
  console.error(message);
  writeLog('ERROR', message);
}

export function setupUiWatchdog() {
  if (watchdogStarted) return;
  watchdogStarted = true;

  logInfo('[Perf] UI watchdog started');

  let expectedAt = performance.now() + EVENT_LOOP_TICK_MS;
  let timer: number | null = null;
  const stop = () => {
    if (timer === null) return;
    window.clearInterval(timer);
    timer = null;
  };
  const start = () => {
    if (timer !== null || document.visibilityState === 'hidden') return;
    expectedAt = performance.now() + EVENT_LOOP_TICK_MS;
    timer = window.setInterval(() => {
      const now = performance.now();
      const lag = now - expectedAt;
      expectedAt = now + EVENT_LOOP_TICK_MS;

      if (lag > EVENT_LOOP_WARN_MS) {
        logWarn(`[Perf] UI event loop lag detected: ${roundMs(lag)}ms`);
      }
    }, EVENT_LOOP_TICK_MS);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stop();
    else start();
  });
  start();

  window.addEventListener('error', (event) => {
    logError(`[UI] Unhandled error: ${event.message}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError(`[UI] Unhandled rejection: ${String(event.reason)}`);
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
  args?: Record<string, unknown>,
  warnMs = INVOKE_WARN_MS,
): Promise<T> {
  return trackAsync(`invoke:${command}`, coreInvoke<T>(command, args), warnMs);
}
