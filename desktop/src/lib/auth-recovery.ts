import { useAuthStore } from '../stores/auth';
import { type RecoveryPhase, useAuthRecoveryStore } from '../stores/auth-recovery';
import { ApiError } from './api';
import { describeError, logInfo } from './diagnostics';
import { queryClient } from './query-client';

/**
 * Оркестратор восстановления сессии.
 *
 * Триггеры (из api-client):
 *   - `noteRateLimit()` — rate-limit. НЕ реагируем на одиночный: накопитель,
 *     модалка только при устойчивом троттлинге (THRESHOLD за WINDOW).
 *   - `noteAuthGap()`   — протухший токен (401) ИЛИ юзер пропал из сайдбара.
 *     Это сильный сигнал → silent renew сразу.
 *   - `noteSuccess()`   — любой успешный ответ: чистит накопитель и, если
 *     всё само починилось, гасит pending-recovery / закрывает модалку.
 *
 * Стратегия: silent renew без UI. Модалка ре-логина — ТОЛЬКО на 401 (SC отверг
 * refresh). Транзиент (5xx/429/timeout) означает недоступный хост, а не мёртвую
 * сессию: тихо ретраим с растущей паузой и НЕ предлагаем перелогиниться — иначе
 * падение бэкенда выкидывает живого юзера. Single-flight по `inFlight` + `phase`.
 */

const RL_WINDOW_MS = 15_000;
const RL_THRESHOLD = 3;
const RECOVERED_COOLDOWN_MS = 5000;
const SILENT_RETRY_DELAY_MS = 2000;
/** Потолок паузы, когда лежит бэкенд: ждать его можно долго, но не молча вечно. */
const OUTAGE_RETRY_MAX_MS = 30_000;

/**
 * Сессия действительно мертва? Только 401 — это вердикт SoundCloud о токене.
 * Всё остальное (5xx нашего бэка, таймаут, обрыв) говорит о доступности хоста,
 * а не о сессии.
 */
function isSessionDead(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

let rlHits: number[] = [];
let inFlight: Promise<void> | null = null;
/** Поколение текущей silent-попытки — для отмены при само-восстановлении. */
let gen = 0;
let cancelledGen = -1;
let silentAttempts = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let lastSuccessAt = 0;

function clearRetryTimer(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

/**
 * Единственная точка смены фазы — и она логируется. Восстановление сессии до сих
 * пор было полностью невидимым: снаружи виден только результат («модалка есть» /
 * «модалки нет»), а из-за какого именно перехода её нет — не видно ниоткуда.
 * Каждый разбор упирался в это, так что переходы теперь в логе.
 */
function movePhase(phase: RecoveryPhase, why: string): void {
  const s = useAuthRecoveryStore.getState();
  logInfo(`[Recovery] ${s.phase} → ${phase} (${why})`);
  s.setPhase(phase);
}

async function runRenew(manual: boolean): Promise<void> {
  if (inFlight) return inFlight;
  clearRetryTimer();

  const myGen = ++gen;
  const store = useAuthRecoveryStore.getState();
  if (manual) {
    silentAttempts = 0;
    store.setBusy(true);
  } else {
    movePhase('silent', 'renew пошёл');
  }

  inFlight = (async () => {
    try {
      await useAuthStore.getState().renewSession();
      silentAttempts = 0;
      clearRetryTimer();
      logInfo('[Recovery] renew удался → сессия жива');
      useAuthRecoveryStore.getState().markRecovered();
      void queryClient.invalidateQueries({
        predicate: (query) => query.state.status === 'error',
        refetchType: 'active',
      });
    } catch (e) {
      // Само-восстановилось параллельным успешным запросом — модалку не лепим.
      if (cancelledGen === myGen) {
        logInfo('[Recovery] вердикт отброшен: авторизованный запрос успел пройти сам');
        return;
      }
      const s = useAuthRecoveryStore.getState();
      s.setBusy(false);
      // Отказ обновления бывает ДВУХ родов, и путать их нельзя.
      // 401 — SC отверг refresh: сессия действительно мертва, нужен ре-логин.
      // 5xx/таймаут/транспорт — лежит НАШ бэкенд: сессия цела, ре-логин её не
      // воскресит, а юзера выкинет. Раньше сюда попадало и то и другое (два
      // любых провала подряд → модалка), и во время падения main пользователю
      // предлагали перелогиниться на ровном месте.
      const needsReauth = isSessionDead(e);
      if (needsReauth) {
        silentAttempts = 0;
        movePhase('modal', `refresh отверг сессию: ${describeError(e)}`);
      } else if (!manual) {
        // Бэкенд лежит — ждём его, не трогая сессию. Пауза растёт, чтобы не
        // долбить упавший хост, но потолок держим: хост вернётся сам.
        silentAttempts++;
        movePhase('idle', `хост недоступен, ждём и повторим: ${describeError(e)}`);
        clearRetryTimer();
        const scheduledAt = Date.now();
        const delay = Math.min(SILENT_RETRY_DELAY_MS * silentAttempts, OUTAGE_RETRY_MAX_MS);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          if (lastSuccessAt > scheduledAt) return; // ожило само за паузу
          void runRenew(false);
        }, delay);
      }
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

function startRecovery(): void {
  const s = useAuthRecoveryStore.getState();
  if (s.phase !== 'idle') return; // renew уже идёт либо модалка уже висит
  if (Date.now() - s.recoveredAt < RECOVERED_COOLDOWN_MS) {
    logInfo('[Recovery] старт подавлен: только что успешно восстановились');
    return;
  }
  void runRenew(false);
}

/** Rate-limit: накапливаем, эскалируем только при устойчивом троттлинге. */
export function noteRateLimit(): void {
  const now = Date.now();
  rlHits.push(now);
  rlHits = rlHits.filter((t) => now - t < RL_WINDOW_MS);
  if (rlHits.length >= RL_THRESHOLD) {
    rlHits = [];
    startRecovery();
  }
}

/** Протухший токен / юзер пропал из сайдбара — реагируем сразу. */
export function noteAuthGap(): void {
  startRecovery();
}

/**
 * Успешный ответ: чистим накопитель и, если всё ожило само, снимаем
 * pending-recovery или авто-закрываем модалку (но не во время ручного
 * renew / OAuth — там юзер сам рулит).
 *
 * `authenticated` — нёс ли запрос `x-session-id`. Считать «сессия жива» можно
 * ТОЛЬКО по такому ответу. Раньше сюда шёл любой 200, в том числе с публичных
 * ручек, и это тихо съедало вердикт: renew под конвоем идёт десятки секунд
 * (в логах — 24 с), за это время успевал пройти какой-нибудь публичный запрос,
 * ставил `cancelledGen` и гасил фазу в idle, а вернувшийся следом 401 от
 * refresh'а упирался в «само починилось» и молча выходил. Модалка ре-логина не
 * показывалась никогда — юзер оставался смотреть на пустой экран.
 */
export function noteSuccess(authenticated: boolean): void {
  if (!authenticated) return;
  lastSuccessAt = Date.now();
  silentAttempts = 0;
  if (rlHits.length) rlHits = [];
  const s = useAuthRecoveryStore.getState();
  if (s.phase === 'idle' || s.busy || s.oauthActive) return;
  cancelledGen = gen;
  s.markRecovered();
}

/** Ручной повтор renew из модалки. */
export function retryRenew(): Promise<void> {
  return runRenew(true);
}

/** Успешный полный re-login (OAuth). */
export function completeReauth(sessionId: string): void {
  void (async () => {
    const auth = useAuthStore.getState();
    await auth.setSession(sessionId);
    await auth.fetchUser().catch(() => {});
    useAuthRecoveryStore.getState().markRecovered();
    queryClient.invalidateQueries();
  })();
}
