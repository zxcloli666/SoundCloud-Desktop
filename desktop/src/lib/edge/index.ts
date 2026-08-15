// Единая точка сетевых запросов фронта к нашим доменам: перебирает тиры
// (прямой → relay) и запоминает, что сработало.

import { fetch } from '@tauri-apps/plugin-http';
import { type Hop, noteHop, planHops } from './config';

export type { Tier } from './config';
export { initEdge, tierOf } from './config';

function timedFetch(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  if (!timeoutMs) return fetch(url, init) as Promise<Response>;

  const controller = new AbortController();
  const callerSignal = init.signal;
  const abortFromCaller = () => controller.abort();

  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', abortFromCaller);
  }) as Promise<Response>;
}

/**
 * Ответ пришёл — но виноват ли транспорт? Relay отдаёт свои 421/502/503/504,
 * прямой хост — HTML-страницу балансера. И то и другое лечится следующим хопом,
 * а ответ origin'а (401/404/500 приложения) — уже валидный результат.
 */
function hopUsable(hop: Hop, res: Response): boolean {
  if (hop.tier === 'relay') return ![421, 502, 503, 504].includes(res.status);
  return !isDirectInfrastructureError(res);
}

function isDirectInfrastructureError(res: Response): boolean {
  if (res.status < 502 || res.status > 504) return false;
  return res.headers.get('content-type')?.toLowerCase().includes('text/html') ?? false;
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
  const msg = error instanceof Error ? error.message.toLowerCase() : '';
  return msg.includes('abort') || msg.includes('timeout') || msg.includes('timed out');
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

export async function edgeFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs?: number,
): Promise<Response> {
  const hops = planHops(url);
  if (hops.length === 0) return timedFetch(url, init, timeoutMs);

  const weakBudget = timeoutMs !== undefined && timeoutMs < WEAK_BUDGET_MS;
  // Бюджет — на ВЕСЬ вызов, а не на каждый хоп. Иначе таймаут молча умножается
  // на длину плана: 10 с control-plane превращались в 20 с на двух хопах и в
  // 40 с на двух базах, и вызывающий получал «Request canceled» вместо ответа.
  const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
  let lastError: unknown = null;

  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i];
    const isLast = i === hops.length - 1;
    const remaining = deadline === undefined ? undefined : deadline - Date.now();
    if (remaining !== undefined && remaining <= 0) break;
    const hopBudget = remaining === undefined ? undefined : hopBudgetMs(remaining, hops.length - i);

    try {
      const res = await timedFetch(hop.url, init, hopBudget);
      if (hopUsable(hop, res)) {
        noteHop(hop, true);
        return res;
      }
      if (hop.tier === 'direct') noteHop(hop, false);
      if (isLast) throw new EdgeTransportError(hop.tier, res.status);
    } catch (error) {
      if (error instanceof EdgeTransportError) throw error;
      lastError = error;
      if (!(weakBudget && isTimeout(error))) noteHop(hop, false);
      // Отмена вызывающим (не таймаут хопа) — перебор бессмысленен.
      if (init.signal?.aborted) throw error;
      if (isLast) throw error;
    }
  }
  throw lastError ?? new Error('edge: budget exhausted before any hop answered');
}
