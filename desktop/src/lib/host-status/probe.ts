import { useAppStatusStore } from '../../stores/app-status';
import { API_BASE, API_STAR_BASE } from '../constants';
import { trackedInvoke as invoke } from '../diagnostics';
import { edgeProbe } from '../edge';
import { getIsPremium, requestPremiumRecheck } from '../premium-cache';
import { queryClient } from '../query-client';
import { fetchExternal } from './external';
import { fetchRemoteVerdict } from './remote';
import { type NetVerdict, useHostStatusStore } from './store';

// ─── Health-карта (per-request data-plane роутинг) ──────────

const UNHEALTHY_DURATION_MS = 30_000;
const unhealthyUntil = new Map<string, number>();

export function isHealthy(host: string): boolean {
  const until = unhealthyUntil.get(host);
  if (until === undefined) return true;
  if (Date.now() > until) {
    unhealthyUntil.delete(host);
    return true;
  }
  return false;
}

export function markHealthy(host: string): void {
  unhealthyUntil.delete(host);
  if (host === API_BASE) noteMainAlive();
  else if (host === API_STAR_BASE && useHostStatusStore.getState().star !== 'up') {
    useHostStatusStore.setState({ star: 'up' });
  }
}

/** Пассивный фейл вердикт НЕ меняет — ставит cooldown и планирует пробу main. */
export function markUnhealthy(host: string): void {
  unhealthyUntil.set(host, Date.now() + UNHEALTHY_DURATION_MS);
  if (host === API_BASE) requestProbe();
}

/** Любой успех main (реальный запрос или проба). Hot path: no-op, если уже up. */
export function noteMainAlive(): void {
  mainAliveGen++;
  const prev = useHostStatusStore.getState().main;
  if (prev === 'up') return;
  useHostStatusStore.setState({ main: 'up', net: 'online', remote: 'unknown' });
  useAppStatusStore.getState().confirmOnline();
  stopRecheckTimer();
  if (prev === 'down') void queryClient.invalidateQueries();
}

// ─── Probe-движок ───────────────────────────────────────────

const PROBE_HOP_TIMEOUT_MS = 5_000;
const CONFIRM_DELAY_MS = 2_000;
const PROBE_MIN_GAP_MS = 5_000;
const RECHECK_MS = 15_000;
const MODAL_RESHOW_SUPPRESS_MS = 10 * 60_000;
const TIMEOUT_BURST_WINDOW_MS = 30_000;
/** Порог таймаутов за окно: ниже = единичные долгие запросы, не падение хоста. */
const TIMEOUT_BURST_THRESHOLD = 3;

interface ProbeResult {
  alive: boolean;
  netFail: boolean;
}

/** Таймаут / отмена по таймауту: наш AbortController или timeout/connect-ошибка reqwest. */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const m = msg.toLowerCase();
  return (
    m.includes('abort') ||
    m.includes('cancel') ||
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('time out')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Статус <500 = хост жив (401/403/429 — тоже ответ); network/timeout = netFail. */
async function probeOnce(base: string): Promise<ProbeResult> {
  const outcome = await edgeProbe(`${base}/health`, PROBE_HOP_TIMEOUT_MS);
  return {
    alive: outcome.kind === 'answered' && outcome.status < 500,
    netFail: outcome.kind === 'unreachable',
  };
}

/** up — с одного успеха; down — только по двум фейлам с паузой (анти-флап). */
async function probeConfirmed(base: string, first?: ProbeResult): Promise<ProbeResult> {
  const initial = first ?? (await probeOnce(base));
  if (initial.alive) return initial;
  await sleep(CONFIRM_DELAY_MS);
  const second = await probeOnce(base);
  if (second.alive) return second;
  return { alive: false, netFail: initial.netFail && second.netFail };
}

async function validatedFetch(
  url: string,
  valid: (res: Response) => boolean | Promise<boolean>,
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

/** Только при обоюдном network-фейле main+star; строгая валидация против captive portal. */
async function checkInternet(): Promise<NetVerdict> {
  const online = await anyTrue([
    validatedFetch('https://www.gstatic.com/generate_204', (res) => res.status === 204),
    validatedFetch(
      'https://detectportal.firefox.com/success.txt',
      async (res) => res.status === 200 && (await res.text()).startsWith('success'),
    ),
    validatedFetch('https://www.cloudflare.com/cdn-cgi/trace', (res) => res.status === 200),
  ]);
  return online ? 'online' : 'no-internet';
}

let lastRunAt = 0;
// Свежесть: реальный успех main, случившийся во время run(), бьёт вердикт пробы.
let mainAliveGen = 0;
let trailingTimer: ReturnType<typeof setTimeout> | null = null;
let recheckTimer: ReturnType<typeof setInterval> | null = null;
let timeoutHits: number[] = [];

function timeoutBurst(): boolean {
  const now = Date.now();
  timeoutHits = timeoutHits.filter((t) => now - t < TIMEOUT_BURST_WINDOW_MS);
  return timeoutHits.length >= TIMEOUT_BURST_THRESHOLD;
}

/** Таймаут реального запроса. Пробу просим лишь когда таймаутят все запросы (бурст), не 1-2 долгих. */
export function noteRequestTimeout(): void {
  timeoutHits.push(Date.now());
  if (timeoutBurst()) requestProbe();
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

/** Single-flight + min-gap с trailing-добивкой; force обходит min-gap, но не single-flight. */
export function requestProbe(opts?: { force?: boolean }): void {
  if (useHostStatusStore.getState().probing) return;
  const sinceLast = Date.now() - lastRunAt;
  if (sinceLast < PROBE_MIN_GAP_MS && !opts?.force) {
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
  void run().finally(() => {
    lastRunAt = Date.now();
    useHostStatusStore.setState({ probing: false });
  });
}

const AUTO_CHECK_GAP_MS = 60_000;
let offlineCheck = false;
let autoCheckAt = 0;

export function noteUnreachable(): void {
  offlineCheck = true;
  const now = Date.now();
  if (now - autoCheckAt >= AUTO_CHECK_GAP_MS) {
    autoCheckAt = now;
    void invoke('net_check_auto', { reason: 'unreachable' });
  }
  requestProbe();
}

function settleOfflineCheck(reachable: boolean): void {
  if (!offlineCheck) return;
  offlineCheck = false;
  if (!reachable) useAppStatusStore.getState().setBackendReachable(false);
}

function markMainUp(): void {
  settleOfflineCheck(true);
  useHostStatusStore.setState({ star: 'unknown', net: 'online' });
  markHealthy(API_BASE); // noteMainAlive: up + стоп recheck-таймера (no-op, если уже up)
  // Снимаем ложный offline и когда вердикт уже 'up' (noteMainAlive тогда no-op).
  useAppStatusStore.getState().confirmOnline();
}

async function run(): Promise<void> {
  const first = await probeOnce(API_BASE);
  if (first.alive) {
    markMainUp();
    return;
  }
  const gen = mainAliveGen;
  const [main, star] = await Promise.all([
    probeConfirmed(API_BASE, first),
    probeConfirmed(API_STAR_BASE),
  ]);
  if (main.alive) {
    markMainUp();
    return;
  }
  const unreachable = main.netFail && star.netFail;
  const internet = unreachable ? await checkInternet() : 'online';
  // Бурст таймаутов = таймаутят все запросы → хост лёг, а не offline: модалку не глушим.
  if (internet === 'no-internet' && !timeoutBurst()) {
    settleOfflineCheck(false);
    useHostStatusStore.setState({ main: 'unknown', star: 'unknown', net: 'no-internet' });
    startRecheckTimer();
    return;
  }
  const remote = star.alive ? 'unknown' : await fetchRemoteVerdict();
  // Реальный успех main за время star-пробы/internet-check — результат устарел, down не пишем.
  if (mainAliveGen !== gen) {
    settleOfflineCheck(true);
    return;
  }
  settleOfflineCheck(!(main.netFail && (!getIsPremium() || star.netFail)));
  const prev = useHostStatusStore.getState();
  const newIncident = prev.main !== 'down';
  const incidentId = newIncident ? prev.incidentId + 1 : prev.incidentId;
  useHostStatusStore.setState({
    main: 'down',
    star: star.alive ? 'up' : 'down',
    net: 'online',
    routeBlocked: unreachable && internet === 'online',
    remote,
    incidentId,
    // Флап-гвард: недавно закрытая модалка не возвращается на новом инциденте.
    ...(newIncident && Date.now() - prev.lastModalDismissAt < MODAL_RESHOW_SUPPRESS_MS
      ? { modalDismissedIncidentId: incidentId }
      : {}),
  });
  if (newIncident) void invoke('net_check_auto', { reason: 'main-down' });
  if (star.alive) markHealthy(API_STAR_BASE); // карта + вердикт; backendReachable не трогаем
  requestPremiumRecheck(); // протухший premium=true / потерянный premium у подписчика
  startRecheckTimer();
}

let initialized = false;

/** Boot-проба + триггеры пробуждения (сеть вернулась / ноут проснулся). Idempotent. */
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
