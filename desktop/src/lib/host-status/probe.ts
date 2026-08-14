import { fetch } from '@tauri-apps/plugin-http';
import { useAppStatusStore } from '../../stores/app-status';
import { API_BASE } from '../constants';
import { edgeFetch } from '../edge';
import { queryClient } from '../query-client';
import { type NetVerdict, useHostStatusStore } from './store';

const PROBE_TIMEOUT_MS = 3_000;
const CONFIRM_DELAY_MS = 2_000;
const PROBE_MIN_GAP_MS = 5_000;
const RECHECK_MS = 15_000;
const MODAL_RESHOW_SUPPRESS_MS = 10 * 60_000;
const TIMEOUT_BURST_WINDOW_MS = 30_000;
const TIMEOUT_BURST_THRESHOLD = 3;

interface ProbeResult {
  alive: boolean;
  netFail: boolean;
}

let mainAliveGeneration = 0;
let lastRunAt = 0;
let trailingTimer: ReturnType<typeof setTimeout> | null = null;
let recheckTimer: ReturnType<typeof setInterval> | null = null;
let timeoutHits: number[] = [];
let initialized = false;

export function isTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const normalized = message.toLowerCase();
  return (
    normalized.includes('abort') ||
    normalized.includes('cancel') ||
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('time out')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchExternal(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeOnce(): Promise<ProbeResult> {
  try {
    const response = await edgeFetch(
      `${API_BASE}/health`,
      { cache: 'no-store' as RequestCache },
      PROBE_TIMEOUT_MS,
    );
    return { alive: response.status < 500, netFail: false };
  } catch {
    return { alive: false, netFail: true };
  }
}

async function probeConfirmed(): Promise<ProbeResult> {
  const first = await probeOnce();
  if (first.alive) return first;
  await sleep(CONFIRM_DELAY_MS);
  const second = await probeOnce();
  return second.alive ? second : { alive: false, netFail: first.netFail && second.netFail };
}

async function validatedFetch(
  url: string,
  valid: (response: Response) => boolean | Promise<boolean>,
): Promise<boolean> {
  try {
    return await valid(await fetchExternal(url));
  } catch {
    return false;
  }
}

function anyTrue(checks: Promise<boolean>[]): Promise<boolean> {
  return new Promise((resolve) => {
    let pending = checks.length;
    for (const check of checks) {
      void check.then((ok) => {
        if (ok) resolve(true);
        else if (--pending === 0) resolve(false);
      });
    }
  });
}

async function checkInternet(): Promise<NetVerdict> {
  const online = await anyTrue([
    validatedFetch('https://www.gstatic.com/generate_204', (response) => response.status === 204),
    validatedFetch(
      'https://detectportal.firefox.com/success.txt',
      async (response) => response.status === 200 && (await response.text()).startsWith('success'),
    ),
    validatedFetch(
      'https://www.cloudflare.com/cdn-cgi/trace',
      (response) => response.status === 200,
    ),
  ]);
  return online ? 'online' : 'no-internet';
}

function timeoutBurst(): boolean {
  const now = Date.now();
  timeoutHits = timeoutHits.filter((timestamp) => now - timestamp < TIMEOUT_BURST_WINDOW_MS);
  return timeoutHits.length >= TIMEOUT_BURST_THRESHOLD;
}

function startRecheckTimer(): void {
  recheckTimer ??= setInterval(() => requestProbe(), RECHECK_MS);
}

function stopRecheckTimer(): void {
  if (recheckTimer !== null) {
    clearInterval(recheckTimer);
    recheckTimer = null;
  }
}

export function noteMainAlive(): void {
  mainAliveGeneration += 1;
  const previous = useHostStatusStore.getState().main;
  if (previous === 'up') return;
  useHostStatusStore.setState({ main: 'up', net: 'online' });
  useAppStatusStore.getState().setBackendReachable(true);
  stopRecheckTimer();
  if (previous === 'down') void queryClient.invalidateQueries();
}

export function markHealthy(host: string): void {
  if (host === API_BASE) noteMainAlive();
}

export function markUnhealthy(host: string): void {
  if (host === API_BASE) requestProbe();
}

export function noteRequestTimeout(): void {
  timeoutHits.push(Date.now());
  if (timeoutBurst()) requestProbe({ force: true });
}

export function requestProbe(options?: { force?: boolean }): void {
  if (!navigator.onLine || useHostStatusStore.getState().probing) return;
  const sinceLast = Date.now() - lastRunAt;
  if (sinceLast < PROBE_MIN_GAP_MS && !options?.force) {
    if (trailingTimer === null) {
      trailingTimer = setTimeout(() => {
        trailingTimer = null;
        requestProbe();
      }, PROBE_MIN_GAP_MS - sinceLast);
    }
    return;
  }

  useHostStatusStore.setState({ probing: true });
  lastRunAt = Date.now();
  void run().finally(() => useHostStatusStore.setState({ probing: false }));
}

async function run(): Promise<void> {
  const main = await probeConfirmed();
  if (main.alive) {
    markHealthy(API_BASE);
    useAppStatusStore.getState().setBackendReachable(true);
    return;
  }

  const generationAfterProbe = mainAliveGeneration;
  if (main.netFail && !timeoutBurst() && (await checkInternet()) === 'no-internet') {
    useHostStatusStore.setState({ main: 'unknown', net: 'no-internet' });
    startRecheckTimer();
    return;
  }

  if (mainAliveGeneration !== generationAfterProbe) return;
  const previous = useHostStatusStore.getState();
  const newIncident = previous.main !== 'down';
  const incidentId = newIncident ? previous.incidentId + 1 : previous.incidentId;
  useHostStatusStore.setState({
    main: 'down',
    net: 'online',
    incidentId,
    ...(newIncident && Date.now() - previous.lastModalDismissAt < MODAL_RESHOW_SUPPRESS_MS
      ? { modalDismissedIncidentId: incidentId }
      : {}),
  });
  useAppStatusStore.getState().setBackendReachable(false);
  startRecheckTimer();
}

export function initHostStatus(): void {
  if (initialized) return;
  initialized = true;
  requestProbe();
  const onWake = () => {
    if (useHostStatusStore.getState().main !== 'up') requestProbe();
  };
  window.addEventListener('online', onWake);
  window.addEventListener('focus', onWake);
}
