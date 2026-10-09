// Единая точка сетевых запросов фронта к нашим доменам: перебирает тиры
// (прямой → relay → relay pro) и запоминает, что сработало.

import { NetError, type NetRoute, netRequest } from '../net/fetch';
import { type Hop, noteHop, planHops, type Tier } from './config';

export type { Tier } from './config';
export { initEdge, tierOf } from './config';

interface Fetched {
  res: Response;
  bytes: number;
  stalled: boolean;
}

function fetchWhole(
  url: string,
  init: RequestInit,
  timeoutMs?: number,
  route?: NetRoute,
): Promise<Fetched> {
  return netRequest(url, { ...init, timeoutMs, route });
}

function isBodyCut(error: unknown): boolean {
  return error instanceof NetError && error.kind === 'body';
}

/**
 * Ответ пришёл — но виноват ли транспорт? Relay отдаёт свой 421, а relay и
 * прямой хост — HTML-страницу балансера на 502-504. И то и другое лечится следующим хопом,
 * а ответ origin'а (401/404/500 приложения) — уже валидный результат.
 */
function hopUsable(hop: Hop, res: Response): boolean {
  if (hop.tier !== 'direct') return !isRelayError(res);
  return !isDirectInfrastructureError(res);
}

function isRelayError(res: Response): boolean {
  if (res.status === 421) return true;
  if (res.status < 502 || res.status > 504) return false;
  return hasContentType(res, 'text/html') || !res.headers.get('content-type');
}

function isDirectInfrastructureError(res: Response): boolean {
  if (res.status < 502 || res.status > 504) return false;
  return hasContentType(res, 'text/html');
}

function hasContentType(res: Response, type: string): boolean {
  return res.headers.get('content-type')?.toLowerCase().includes(type) ?? false;
}

/**
 * Короткий бюджет (проба хостов — 3 с) не доказывает, что прямой путь закрыт:
 * первый холодный TLS у медленного канала в него не влезает. Такой запрос всё
 * равно уйдёт следующим тиром, но вердикт не двигаем — иначе здоровые юзеры
 * переезжают на relay из-за одной медленной пробы. Реальный бан режет соединение
 * сразу (RST), так что на скорость детекта это не влияет.
 */
const WEAK_BUDGET_MS = 5_000;

function isTimeout(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('abort') ||
    msg.includes('cancel') ||
    msg.includes('timeout') ||
    msg.includes('timed out')
  );
}

/**
 * Отказ ТРАНСПОРТА, дошедший до вызывающего: страница CF/балансера вместо ответа
 * приложения. Отдельный тип, чтобы `api-client` не принял её за ответ API —
 * иначе 429 от воркера читается как «нас рейт-лимитят», а 502 балансера как
 * «сервер лёг», и то и другое будит recovery сессии на ровном месте.
 */
export class EdgeTransportError extends Error {
  constructor(
    readonly tier: string,
    readonly status: number,
  ) {
    super(`edge: ${tier} answered ${status} (transport, not the application)`);
    this.name = 'EdgeTransportError';
  }
}

export class EdgeUnreachableError extends Error {
  constructor(readonly cause: unknown) {
    super(`edge: no route answered (${messageOf(cause)})`);
    this.name = 'EdgeUnreachableError';
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Резерв под запасные хопы. Делить бюджет поровну нельзя: отвечает обычно ПЕРВЫЙ
 * хоп, и его легитимно долгий ответ дороже, чем шанс попробовать резерв. При
 * бюджете 30 с прямой путь получает 20 с — этого хватает на наблюдавшиеся на
 * проде 17.9 с под конвоем refresh-лока, а relay всё равно остаётся с 10 с.
 */
const FALLBACK_RESERVE_MS = 10_000;

/** Сколько времени отдать этому хопу; последнему достаётся весь остаток. */
function hopBudgetMs(remaining: number, hopsLeft: number): number {
  if (hopsLeft <= 1) return remaining;
  const reserve = Math.min(FALLBACK_RESERVE_MS, Math.floor(remaining / 3));
  return remaining - reserve;
}

const BACKUP_DELAY_MS = 300;

export type ProbeOutcome =
  | { kind: 'answered'; status: number; tier: Tier }
  | { kind: 'transport' }
  | { kind: 'unreachable' };

export function edgeProbe(url: string, hopTimeoutMs: number): Promise<ProbeOutcome> {
  const planned = planHops(url);
  const hops: Hop[] = planned.length > 0 ? planned : [{ url, tier: 'direct', origin: '' }];
  const controllers = hops.map(() => new AbortController());
  return new Promise((resolve) => {
    let pending = hops.length;
    let transport = false;
    let done = false;
    let backupsStarted = false;
    let backupTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (outcome: ProbeOutcome) => {
      if (done) return;
      done = true;
      clearTimeout(backupTimer);
      for (const controller of controllers) controller.abort();
      resolve(outcome);
    };
    const settle = () => {
      pending -= 1;
      if (pending === 0) finish({ kind: transport ? 'transport' : 'unreachable' });
    };
    const startBackups = () => {
      if (backupsStarted || done) return;
      backupsStarted = true;
      clearTimeout(backupTimer);
      for (let at = 1; at < hops.length; at++) start(at);
    };
    const start = (at: number) => {
      const hop = hops[at];
      const init: RequestInit = { cache: 'no-store', signal: controllers[at].signal };
      const over = () => {
        settle();
        if (at === 0) startBackups();
      };
      fetchWhole(hop.url, init, hopTimeoutMs).then(
        ({ res }) => {
          if (hopUsable(hop, res)) finish({ kind: 'answered', status: res.status, tier: hop.tier });
          else transport = true;
          over();
        },
        (error) => {
          if (isBodyCut(error)) transport = true;
          over();
        },
      );
    };
    start(0);
    if (hops.length > 1) backupTimer = setTimeout(startBackups, BACKUP_DELAY_MS);
  });
}

async function fetchAlone(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  try {
    return (await fetchWhole(url, init, timeoutMs)).res;
  } catch (error) {
    if (init.signal?.aborted || isBodyCut(error)) throw error;
    throw new EdgeUnreachableError(error);
  }
}

export async function edgeFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs?: number,
): Promise<Response> {
  const hops = planHops(url);
  if (hops.length === 0) return fetchAlone(url, init, timeoutMs);

  const weakBudget = timeoutMs !== undefined && timeoutMs < WEAK_BUDGET_MS;
  const replayable = ['GET', 'HEAD'].includes((init.method ?? 'GET').toUpperCase());
  // Бюджет — на ВЕСЬ вызов, а не на каждый хоп. Иначе таймаут молча умножается
  // на длину плана: 10 с control-plane превращались в 20 с на двух хопах и в
  // 40 с на двух базах, и вызывающий получал «Request canceled» вместо ответа.
  const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
  let lastError: unknown = null;
  let attempted = 0;
  let answered = false;

  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i];
    const isLast = i === hops.length - 1;
    const remaining = deadline === undefined ? undefined : deadline - Date.now();
    if (remaining !== undefined && remaining <= 0) break;
    const hopBudget = remaining === undefined ? undefined : hopBudgetMs(remaining, hops.length - i);
    attempted += 1;

    try {
      const route = { tier: hop.tier, origin: hop.origin, attempt: i, last: isLast };
      const { res, bytes, stalled } = await fetchWhole(hop.url, init, hopBudget, route);
      answered = true;
      if (hopUsable(hop, res)) {
        noteHop(hop, !(stalled && hop.tier === 'direct'), bytes);
        return res;
      }
      noteHop(hop, false);
      if (isLast) throw new EdgeTransportError(hop.tier, res.status);
    } catch (error) {
      if (error instanceof EdgeTransportError) throw error;
      lastError = error;
      // Отмена вызывающим (не таймаут хопа) — перебор бессмысленен.
      if (init.signal?.aborted) throw error;
      const cut = isBodyCut(error);
      if (cut) answered = true;
      if (!(weakBudget && isTimeout(error))) noteHop(hop, false);
      if (cut && !replayable) throw error;
    }
  }
  if (attempted === hops.length && !answered) throw new EdgeUnreachableError(lastError);
  throw lastError ?? new Error('edge: budget exhausted before any hop answered');
}
