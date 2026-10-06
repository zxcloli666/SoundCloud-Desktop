import { toast } from 'sonner';
import i18n from '../i18n';
import { useAppStatusStore } from '../stores/app-status';
import { useAuthStore } from '../stores/auth';
import { noteAuthGap, noteRateLimit, noteSuccess } from './auth-recovery';
import { API_BASE, API_STAR_BASE } from './constants';
import { logHttpError, logHttpFailure, logInfo, trackAsync } from './diagnostics';
import { edgeFetch } from './edge';
import {
  getHostVerdict,
  isHealthy,
  isIncidentActive,
  isMainDegraded,
  isTimeoutError,
  markHealthy,
  markMainDegraded,
  markUnhealthy,
  noteMainBadResponse,
  noteRequestTimeout,
  preferredControlBase,
  SLOW_RESPONSE_MS,
} from './host-status';
import { getIsPremium, requestPremiumRecheck } from './premium-cache';

// ─── Session ────────────────────────────────────────────────

let sessionId: string | null = null;

/**
 * Зеркало сессии заполняет ровно одно место — `applyAuthFromServer`, и до этого
 * момента авторизованный запрос обречён: уходит без `x-session-id` и получает
 * 401 «Missing or malformed». На старте так сгорали `/history` и `/tracks` от
 * восстановленного из кеша плеера — два гарантированных 401 в логе ещё до того,
 * как приложение узнало, залогинен ли юзер вообще.
 *
 * Поэтому первый запрос ждёт, пока мост ответит хоть что-нибудь (в т.ч. «нет
 * сессии» — это тоже ответ). Ожидание с потолком: у трея свой webview, моста
 * там нет, и без потолка его запросы висели бы вечно.
 */
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

// ─── Error ──────────────────────────────────────────────────

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
  const b = body.toLowerCase();
  return b.includes('rate limit') || b.includes('rate-limited') || b.includes('too many requests');
}

// ─── Helpers ────────────────────────────────────────────────

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  return edgeFetch(url, options, timeoutMs);
}

function handleApiError(err: ApiError): void {
  if (err.status >= 500) {
    if (isIncidentActive()) return; // авария уже показана модалкой/баннером
    // Фиксированный id: sonner заменяет тост, шторм не стекается.
    toast.error(i18n.t('errors.serverError', { status: err.status }), { id: 'api-server-error' });
  } else if (err.status >= 400 && err.status !== 401) {
    try {
      const parsed = JSON.parse(err.body);
      toast.error(parsed.message || parsed.error || `Error ${err.status}`);
    } catch {
      toast.error(`Error ${err.status}`);
    }
  }
}

// ─── Main API client ────────────────────────────────────────

export type ApiRequestOptions = RequestInit & {
  /**
   * HTTP-статусы, которые считаем штатными: без error-тоста, без auth/rate-limit
   * recovery и без error-лога. ApiError всё равно бросается — тихо, чтобы вызвавший
   * мог свести его к дефолту (напр. 404 /related → пустой список похожих).
   */
  silentStatuses?: number[];
};

/**
 * Бюджеты — по замерам на проде (30.07.2026), а не на глаз. Причина, по которой
 * авторизованные ручки медленные, одна: `get_valid_session` на бэке при протухшем
 * токене держит per-session мьютекс, пока ходит в SoundCloud за новым. Клиент в
 * этот момент шлёт десятки запросов, и все они стоят в этой очереди. Так что
 * «медленно» здесь — штатное поведение, а не признак смерти хоста.
 *
 * `/auth/*`  — бэк round-trip'ит в SoundCloud: login замерен 4.2–11.7 с.
 * `/me/subscription` — сама ручка это один SELECT, но под конвоем refresh-лока
 *   в логах видны легитимные 17.9 с.
 * data-plane — `/recommendations` доходил до 49.8 с.
 *
 * Хост, уже признанный мёртвым, всё это не ждёт: `DOWN_HOST_TIMEOUT_MS`.
 */
const AUTH_TIMEOUT_MS = 30_000;
const SUBSCRIPTION_TIMEOUT_MS = 30_000;
const DATA_PLANE_TIMEOUT_MS = 90_000;
const DOWN_HOST_TIMEOUT_MS = 10_000;

/**
 * main опустился до роли страховки? Вердикта пробы для этого мало: 'down'
 * ставится по `/health`, а он отвечает и когда хост уже ничего не обслуживает
 * (см. `host-status/degraded.ts`). Деградация — тот же приговор для роутинга,
 * но только для того, кому star ответит: не-премиум получит там 403, и уводить
 * его туда значит менять медленный ответ на быстрый отказ.
 */
function mainIsLastResort(): boolean {
  if (getHostVerdict(API_BASE) === 'down') return true;
  return isMainDegraded() && getIsPremium();
}

/**
 * Базы запроса, primary первой.
 * /me/subscription — открыт на star (bootstrap-сигнал премиума): перебор обоих, primary по состоянию main.
 * /auth/login* — прибит к main: OAuth redirect_uri зарегистрирован в SC только на основной хост.
 * остальной /auth/* (refresh, link/*, logout) — ровно ОДИН хост по вердикту: refresh нельзя
 *   фейловерить перебором (per-process refresh_locks на бэке → двойная ротация refresh_token),
 *   link-токены single-use.
 * data-plane — премиум → star, main страховкой. GET/HEAD фейловерят свободно, мутации
 * знают main как страховку, но переключаются туда только на явной
 * инфраструктурной HTML-ошибке (запрос не дошёл до приложения).
 */
function apiBasesFor(path: string): string[] {
  if (path === '/me/subscription') {
    return mainIsLastResort() ? [API_STAR_BASE, API_BASE] : [API_BASE, API_STAR_BASE];
  }
  if (path.startsWith('/auth/login')) return [API_BASE];
  if (path.startsWith('/auth/refresh')) {
    // Единственная control-plane мутация, которую можно переиграть на соседе, и
    // делать это обязательно: 401 отсюда — приговор «сессия мертва», после
    // которого юзеру показывают ре-логин. Сессия у хостов ОБЩАЯ, так что 401 от
    // одного при живой сессии значит «сломан этот хост», а не «сессия умерла».
    // Проверять чужой вердикт до того, как выкинуть человека из аккаунта, —
    // минимум приличия. Переигрываем строго по 401 (см. `canReplayOnNextHost`).
    const primary = preferredControlBase();
    return [primary, primary === API_BASE ? API_STAR_BASE : API_BASE];
  }
  if (path.startsWith('/auth/')) return [preferredControlBase()];
  if (!getIsPremium() || !sessionId) return [API_BASE];
  // Cooldown star'а уводит премиум на main только пока main есть чем ответить.
  // Иначе star остаётся первым: его 30-секундная отсидка — это одна осечка, а
  // не приговор, и переиграть её дешевле, чем встать в конвой на main. Раньше
  // тут был `[API_BASE]` без star вовсе — любая осечка star'а на полминуты
  // намертво возвращала подписчика на main, даже когда main уже задыхался.
  return isHealthy(API_STAR_BASE) || mainIsLastResort()
    ? [API_STAR_BASE, API_BASE]
    : [API_BASE, API_STAR_BASE];
}

/** Бюджет запроса по его пути. */
function planeTimeout(path: string): number {
  if (path.startsWith('/auth/')) return AUTH_TIMEOUT_MS;
  if (path === '/me/subscription') return SUBSCRIPTION_TIMEOUT_MS;
  return DATA_PLANE_TIMEOUT_MS;
}

/**
 * Сэмпл для детектора деградации main. Провал плох всегда; медленный ответ —
 * только вне `/auth/*`: там бэк round-trip'ит в SoundCloud, и замеренные на
 * логине 4.2–11.7 с это норма хендлера, а не состояние хоста.
 */
function isMainBadSample(path: string, ok: boolean, elapsedMs: number): boolean {
  if (!ok) return true;
  return !path.startsWith('/auth/') && elapsedMs >= SLOW_RESPONSE_MS;
}

/** Короткое имя хоста для логов перебора. */
function hostLabel(base: string): string {
  return base === API_BASE ? 'main' : base === API_STAR_BASE ? 'star' : base;
}

/** Host-фейл → фейловер. 4xx-контракты (400/404/…) — валидный ответ, не фейлим. */
function isHostFailover(status: number): boolean {
  return status >= 500 || status === 401 || status === 403;
}

/**
 * Load-balancer/proxy failures are safe to replay even for a mutation: the
 * HTML error page means the request never reached the API application. JSON
 * 5xx responses remain application errors and are not replayed.
 */
function isInfrastructureFailure(status: number, body: string): boolean {
  if (status < 500) return false;
  const b = body.toLowerCase();
  return b.includes('<html') || b.includes('no server is available');
}

/**
 * Можно ли повторить ЭТОТ запрос на следующем хосте. GET/HEAD — всегда,
 * инфраструктурный отказ — всегда (до приложения не дошло).
 *
 * Отдельный случай — 401 на `/auth/refresh`. Refresh прибит к одному хосту
 * ровно из-за риска двойной ротации refresh_token, но 401 приходит из lookup'а
 * сессии ДО всякой ротации: `Backend/api/src/modules/auth/service.rs`,
 * `refresh_session` — `get_session` → 401 «Session not found», и только ниже
 * лок и `do_refresh`. Ротации не было, переигрывать безопасно. Таймаут и 5xx
 * по-прежнему нельзя: там запрос мог дойти и примениться.
 */
function canReplayOnNextHost(path: string, method: string, status: number, body: string): boolean {
  if (method === 'GET' || method === 'HEAD') return true;
  if (isInfrastructureFailure(status, body)) return true;
  return path.startsWith('/auth/refresh') && status === 401;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
  timeoutMs?: number,
): Promise<T> {
  const { silentStatuses, ...init } = options;
  // Мост мог ещё не дойти до зеркала — иначе запрос уйдёт без сессии в никуда.
  if (!sessionKnown) await awaitSessionKnown();
  const headers = new Headers(init.headers);
  // Защита от попадания строки "undefined"/"null" в header при апгрейдах формата API.
  const authenticated = !!sessionId && sessionId !== 'undefined' && sessionId !== 'null';
  if (authenticated) {
    headers.set('x-session-id', sessionId as string);
  }
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');

  const method = init.method ?? 'GET';
  const label = `${method.toUpperCase()} ${path}`;
  const bases = apiBasesFor(path);
  const effectiveTimeout = timeoutMs ?? planeTimeout(path);
  let lastError: unknown = null;
  /** main отказал по этой сессии — ждём, что скажет сосед по ней же. */
  let mainRefused = false;
  /** Первый 401 в переборе: приговор сессии выносит он, а не гейтовый 403 star'а. */
  let authRejection: ApiError | null = null;

  for (let i = 0; i < bases.length; i++) {
    const base = bases[i];
    const isLast = i === bases.length - 1;
    const url = `${base}${path}`;
    const attemptStart = performance.now();

    // Хост с вердиктом down не держит попытку дольше 10 c.
    const attemptTimeout =
      getHostVerdict(base) === 'down'
        ? Math.min(effectiveTimeout, DOWN_HOST_TIMEOUT_MS)
        : effectiveTimeout;

    try {
      const res = await trackAsync(
        `http:${label}`,
        fetchWithTimeout(url, { ...init, headers }, attemptTimeout),
      );

      // Жив = ответил <500 (как probeOnce; 401/403 — валидный ответ axum, star они
      // НЕ марают — иначе протухший токен выключал бы star при мёртвом main).
      // ≥500 — пассивный фейл: cooldown + проба main; вердикт down ставит только проба.
      if (res.status < 500) markHealthy(base);
      else markUnhealthy(base);
      if (
        base === API_BASE &&
        isMainBadSample(path, res.status < 500, performance.now() - attemptStart)
      ) {
        noteMainBadResponse();
      }
      // Успех star для не-премиума — probe-сигнал, не «онлайн» (иначе флап offline↔online).
      if (base === API_BASE || getIsPremium()) {
        useAppStatusStore.getState().setBackendReachable(true);
      }

      // Сосед отдал по ТОЙ ЖЕ сессии то, в чём main только что отказал. Сессия
      // общая — значит сломан main, а не она. Доказательство, а не сэмпл:
      // уводим туда весь трафик сразу, не набирая окно.
      if (res.ok && mainRefused && base !== API_BASE) {
        markMainDegraded();
        logInfo(`[Host] main отказал в ${label}, star отдал по той же сессии → идём со star`);
      }

      if (!res.ok) {
        const body = await res.text();
        const err = new ApiError(res.status, body);

        // Ожидаемый гейт-отказ star (не-премиум): не шум, а подозрение —
        // сверочный запрос сам себя не триггерит.
        const starDeny = base === API_STAR_BASE && res.status === 403;
        if (starDeny && path !== '/me/subscription') requestPremiumRecheck();

        // Штатный по контракту статус (напр. 404 /related = соседей пока нет):
        // глушим тихо — без тоста, без recovery, без error-лога.
        if (silentStatuses?.includes(res.status)) throw err;

        if (res.status === 401) authRejection ??= err;

        if (
          !isLast &&
          isHostFailover(res.status) &&
          canReplayOnNextHost(path, method, res.status, body)
        ) {
          lastError = err;
          if (base === API_BASE) mainRefused = true;
          // Промежуточный отказ раньше не попадал в лог вообще (logHttpError
          // зовётся только на последней базе). Снаружи это читалось как «на star
          // запросы не уходят», хотя уходили первыми — просто молча. Перебор
          // обязан быть видимым, иначе его не отладить.
          logInfo(`[Host] ${label}: ${hostLabel(base)} → ${res.status}, пробуем следующий`);
          // Сосед сейчас ответит по той же сессии — а значит 401 отсюда ещё не
          // повод будить recovery. Разбудим его на последнем хосте, если и там
          // откажут; иначе сломанный хост в одиночку выкидывал бы из аккаунта.
          continue;
        }

        // Гейтовый 403 star'а — «хост не твой», а не ответ по сессии. Если main
        // до него сказал 401, приговор выносит именно 401: иначе отказ доступа к
        // резервному хосту маскировал бы мёртвую сессию, и ре-логин не
        // предложили бы никогда — юзер остался бы с вечно пустым экраном.
        const verdict = starDeny && authRejection ? authRejection : err;

        logHttpError(label, verdict.status, url, verdict.body);

        // Rate-limit — копим, одиночный не дёргает recovery.
        if (isRateLimitError(verdict.status, verdict.body)) {
          noteRateLimit();
          console.error(`HTTP ERROR: url: ${path}, `, verdict);
          throw verdict;
        }

        // Протухший токен (401) либо юзер пропал из сайдбара — сильный
        // сигнал, silent renew сразу. Гейтовый 403 star recovery не дёргает.
        //
        // 5xx сюда НЕ попадает: «сервер сломался» не значит «сессия умерла».
        // На холодном старте `user` ещё null, и бэкендовый 502 (в т.ч. штатный
        // «Renewing your session, try again shortly») уводил в recovery, а через
        // две тихих попытки — в модалку «сессия истекла».
        const looksLikeAuthGap =
          verdict.status === 401 ||
          (verdict.status < 500 && useAuthStore.getState().user == null && !starDeny);
        if (looksLikeAuthGap) {
          noteAuthGap();
          console.error(`HTTP ERROR: url: ${path}, `, verdict);
          throw verdict;
        }

        if (!starDeny) handleApiError(err);
        console.error(`HTTP ERROR: url: ${path}, `, err);
        throw err;
      }

      // Успешный ответ — чистит rate-limit накопитель и само-гасит recovery,
      // если всё ожило само. Только авторизованный: публичная 200 про сессию
      // не говорит ничего и не имеет права снимать вердикт.
      noteSuccess(authenticated);

      const ct = res.headers.get('content-type');
      const reply = await (ct?.includes('application/json') ? res.json() : (res.text() as T));

      if (typeof reply === 'string') {
        try {
          return JSON.parse(reply) as T;
        } catch {}
      }

      return reply;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      markUnhealthy(base);
      if (base === API_BASE) noteMainBadResponse();
      if (isTimeoutError(error)) noteRequestTimeout();
      if (!isLast) {
        lastError = error;
        logInfo(`[Host] ${label}: ${hostLabel(base)} не ответил, пробуем следующий`);
        continue;
      }
      logHttpFailure(label, url, error, performance.now() - attemptStart);
      useAppStatusStore.getState().setBackendReachable(false);
      throw error;
    }
  }

  throw lastError ?? new Error('Request failed');
}

// ─── Aliases ────────────────────────────────────────────────

export const fetchWithAuthFallback = apiRequest;
