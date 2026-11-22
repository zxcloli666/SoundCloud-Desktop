import { useQuery } from '@tanstack/react-query';
import { useAppStatusStore } from '../stores/app-status';
import { useAuthStore } from '../stores/auth';
import { api, getSessionId } from './api';
import { noteAuthGap } from './auth-recovery';
import { API_BASE, API_STAR_BASE } from './constants';
import { trackedInvoke as invoke, logInfo } from './diagnostics';
import { edgeFetch } from './edge';
import { markMainDegraded } from './host-status';
import { getIsPremium, setIsPremium, setPremiumRecheckHandler } from './premium-cache';
import { queryClient } from './query-client';

export { getIsPremium } from './premium-cache';

interface SubscriptionResponse {
  premium: boolean;
}

const QUERY_KEY = ['me', 'subscription'] as const;

async function fetchSubscription(): Promise<SubscriptionResponse> {
  const token = getSessionId();
  try {
    const res = await api<SubscriptionResponse>('/me/subscription');
    // Session changed (logout / re-login) while we awaited — drop the result.
    if (getSessionId() !== token) return { premium: getIsPremium() };
    if (res.premium !== getIsPremium()) {
      setIsPremium(res.premium);
      // Premium подтверждён сетевым ответом — data-plane достижим, не ждём recheck-кулдауна.
      if (res.premium) useAppStatusStore.getState().setBackendReachable(true);
      void invoke('auth_set_premium', { premium: res.premium }).catch(() => {});
    }
    return res;
  } catch {
    // Network failure / both hosts down: keep cached value, don't reset to false
    return { premium: getIsPremium() };
  }
}

export function isKnownNonPremium(): boolean {
  return queryClient.getQueryData<SubscriptionResponse>(QUERY_KEY)?.premium === false;
}

export function useSubscription(enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchSubscription,
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
    select: (d) => d.premium,
  });
}

// Сверка по подозрению (star 403 / вход в star-reserve): single-flight + cooldown.
// Гейт только hasSession (не isAuthenticated): при мёртвом main /me/cold не проходит,
// recheck — единственный путь восстановления premium у залогиненного юзера.
const RECHECK_COOLDOWN_MS = 30_000;
let recheckInFlight = false;
let lastRecheckAt = 0;
setPremiumRecheckHandler(() => {
  if (!useAuthStore.getState().hasSession) return;
  const now = Date.now();
  if (recheckInFlight || now - lastRecheckAt < RECHECK_COOLDOWN_MS) return;
  recheckInFlight = true;
  lastRecheckAt = now;
  void fetchSubscription()
    .then((d) => queryClient.setQueryData(QUERY_KEY, d))
    .finally(() => {
      recheckInFlight = false;
    });
});

// ─── Бутстрап премиума: спрашиваем ОБА хоста разом ──────────

/**
 * «Есть ли у меня подписка?» — вопрос, который нельзя задавать только main.
 *
 * Раньше цепочка была: `/me/cold` (main) → `isAuthenticated` → `useSubscription`
 * → premium → star. Каждое звено ждало предыдущего, и всё это висело на main.
 * Стоит ему начать отдавать 401 «Session not found» при живой (общей на два
 * хоста!) сессии — цепочка встаёт колом на первом же звене: `/me/cold` падает,
 * `isAuthenticated` не встаёт, `/me/subscription` не запускается, premium
 * остаётся false, и star не пробуется НИКОГДА. Юзер сидит с пустым экраном на
 * сломанном хосте, при живом резервном.
 *
 * Поэтому вопрос уходит на оба хоста ПАРАЛЛЕЛЬНО, до всего остального, и верим
 * тому, кто ответил утвердительно: сессия у хостов общая, так что «да» от star
 * там, где main отказал, означает поломку main, а не смерть сессии.
 */
const BOOTSTRAP_TIMEOUT_MS = 8_000;

/** Что хост сказал про подписку. `null` = не ответил (см. `status` — чем именно). */
interface SubscriptionAnswer {
  premium: boolean | null;
  /** HTTP-статус либо 'error' (сеть/таймаут) — чтобы в логе было видно ПОЧЕМУ. */
  status: number | 'error';
}

/** Один прямой вопрос конкретному хосту: без фейловера, тостов и recovery. */
async function askSubscription(base: string, token: string): Promise<SubscriptionAnswer> {
  try {
    const res = await edgeFetch(
      `${base}/me/subscription`,
      { headers: { 'x-session-id': token }, cache: 'no-store' as RequestCache },
      BOOTSTRAP_TIMEOUT_MS,
    );
    // 401/403/5xx — «не ответил». Гейт star для не-премиума тоже приходит сюда
    // как 403 и обязан читаться как «не знаю», а не как «подписки нет».
    if (!res.ok) return { premium: null, status: res.status };
    const body = (await res.json()) as SubscriptionResponse;
    return { premium: body.premium === true, status: res.status };
  } catch {
    return { premium: null, status: 'error' };
  }
}

let bootstrapDone = false;

export async function bootstrapPremium(): Promise<void> {
  const token = getSessionId();
  if (!token || bootstrapDone) return;
  bootstrapDone = true;

  const [main, star] = await Promise.all([
    askSubscription(API_BASE, token),
    askSubscription(API_STAR_BASE, token),
  ]);
  if (getSessionId() !== token) return; // логаут/ре-логин пока ждали

  const premium = main.premium === true || star.premium === true;
  logInfo(
    `[Premium] bootstrap: main=${main.premium}(${main.status}) ` +
      `star=${star.premium}(${star.status}) → premium=${premium}`,
  );
  // Хоть один хост ОТВЕРГ сессию (401), и ни один её не подтвердил — поднимаем
  // recovery сразу. Требовать 401 от обоих нельзя: когда main лежит, он отвечает
  // `error`, а не 401, и условие никогда не сойдётся — ровно тот случай, когда
  // объяснение нужнее всего. Ложной тревоги здесь нет: recovery сам сходит
  // refresh'ем на ОБА хоста и только тогда решит, мертва ли сессия.
  if (!premium && (main.status === 401 || star.status === 401)) {
    logInfo('[Premium] сессию отвергли (401), подтверждения нет → поднимаем recovery');
    noteAuthGap();
  }

  if (premium) {
    if (!getIsPremium()) {
      setIsPremium(true);
      void invoke('auth_set_premium', { premium: true }).catch(() => {});
    }
    useAppStatusStore.getState().setBackendReachable(true);
    if (star.premium === true && main.premium !== true) {
      // star отдал то, в чём main отказал, по ОДНОЙ И ТОЙ ЖЕ сессии. Сломана не
      // сессия — сломан main. Уводим туда весь трафик сразу, не набирая окно.
      markMainDegraded();
      logInfo('[Premium] main отказал там, где star подтвердил ту же сессию → идём со star');
    }
  } else if (main.premium === false || star.premium === false) {
    // Утвердительный отказ (200 + premium:false), а не молчание хоста.
    if (getIsPremium()) {
      setIsPremium(false);
      void invoke('auth_set_premium', { premium: false }).catch(() => {});
    }
  }

  queryClient.setQueryData(QUERY_KEY, { premium: getIsPremium() });
}

// Гейт — hasSession, а НЕ isAuthenticated: последний ставится успехом `/me/cold`
// на main, то есть ровно тем, что в этом инциденте и не проходит.
useAuthStore.subscribe((state, prev) => {
  if (state.hasSession && !prev.hasSession) {
    bootstrapDone = false;
    void bootstrapPremium();
  }
});
