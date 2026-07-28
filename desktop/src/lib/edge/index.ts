// Единая точка сетевых запросов фронта к нашим доменам: перебирает тиры
// (прямой → relay → воркеры) и запоминает, что сработало.

import { fetch } from '@tauri-apps/plugin-http';
import { banWorker, type Hop, noteHop, noteWorkerServerError, planHops } from './config';

export type { Tier } from './config';
export { initEdge, tierOf } from './config';

function withHop(init: RequestInit, hop: Hop): RequestInit {
  if (!hop.xTarget) return init;
  const headers = new Headers(init.headers);
  headers.set('X-Target', hop.xTarget);
  return { ...init, headers };
}

function timedFetch(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  if (!timeoutMs || init.signal) return fetch(url, init) as Promise<Response>;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  ) as Promise<Response>;
}

/**
 * Ответ пришёл — но виноват ли транспорт? Relay отдаёт свои 502/503/504/421,
 * воркер — 429 от самого Cloudflare. И то и другое лечится следующим хопом,
 * а ответ origin'а (401/404/500 приложения) — уже валидный результат.
 */
function hopUsable(hop: Hop, res: Response): boolean {
  if (hop.tier === 'direct') return true;
  if (hop.tier === 'relay') return ![421, 502, 503, 504].includes(res.status);

  if (res.status === 429 && isCloudflareEdgeError(res)) {
    banWorker(hop.url, true);
    return false;
  }
  if (res.status >= 500) {
    // На части origin'ов (images) 5xx воркера — это и есть рейт-лимит CF,
    // и минутного бана там мало: см. `worker_5xx_is_ratelimit` в ядре.
    noteWorkerServerError(hop);
    return false;
  }
  return true;
}

function isCloudflareEdgeError(res: Response): boolean {
  const server = res.headers.get('server')?.toLowerCase() ?? '';
  const ct = res.headers.get('content-type')?.toLowerCase() ?? '';
  return server.includes('cloudflare') && ct.includes('text/plain');
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

export async function edgeFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs?: number,
): Promise<Response> {
  const hops = planHops(url);
  if (hops.length === 0) return timedFetch(url, init, timeoutMs);

  const weakBudget = timeoutMs !== undefined && timeoutMs < WEAK_BUDGET_MS;
  let lastError: unknown = null;
  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i];
    const isLast = i === hops.length - 1;
    try {
      const res = await timedFetch(hop.url, withHop(init, hop), timeoutMs);
      if (hopUsable(hop, res)) {
        noteHop(hop, true);
        return res;
      }
      // Последний хоп отдаём как есть: реальный статус полезнее брошенной ошибки.
      if (isLast) return res;
    } catch (error) {
      lastError = error;
      if (!(weakBudget && isTimeout(error))) noteHop(hop, false);
      // Отмена вызывающим (не таймаут хопа) — перебор бессмысленен.
      if (init.signal?.aborted) throw error;
      if (isLast) throw error;
    }
  }
  throw lastError ?? new Error('edge: all hops failed');
}
