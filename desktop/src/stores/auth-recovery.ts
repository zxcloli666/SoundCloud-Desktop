import { create } from 'zustand';

/**
 * Состояние авто-восстановления сессии.
 *
 * - `idle`   — всё хорошо, ничего не делаем.
 * - `silent` — идёт первая, автоматическая попытка renew. Модалки НЕТ:
 *              для юзера всё должно пройти незаметно.
 * - `modal`  — авто-renew не помог. Показываем единственную модалку, где
 *              можно повторить renew вручную либо войти заново (OAuth).
 *
 * `busy` — внутри модалки идёт ручной renew (спиннер, модалка не закрывается).
 * OAuth-флоу трекается отдельно в самой модалке (useOAuthFlow.isPolling).
 *
 * Логика переходов живёт в `lib/auth-recovery.ts`, тут только стейт.
 */
export type RecoveryPhase = 'idle' | 'silent' | 'modal';
export type RenewFailure = 'dead' | 'transient';

interface AuthRecoveryState {
  phase: RecoveryPhase;
  busy: boolean;
  lastFailure: RenewFailure | null;
  /** Идёт OAuth-поллинг в модалке — авто-закрытие по успеху не трогаем. */
  oauthActive: boolean;
  /** Момент последнего успешного восстановления — для cooldown. */
  recoveredAt: number;
  setPhase: (phase: RecoveryPhase) => void;
  setBusy: (busy: boolean) => void;
  setLastFailure: (lastFailure: RenewFailure | null) => void;
  setOauthActive: (oauthActive: boolean) => void;
  /** Успех: гасим модалку и ставим cooldown-метку. */
  markRecovered: () => void;
  /** Сброс без cooldown (dismiss / logout). */
  reset: () => void;
}

export const useAuthRecoveryStore = create<AuthRecoveryState>((set) => ({
  phase: 'idle',
  busy: false,
  lastFailure: null,
  oauthActive: false,
  recoveredAt: 0,
  setPhase: (phase) => set({ phase }),
  setBusy: (busy) => set({ busy }),
  setLastFailure: (lastFailure) => set({ lastFailure }),
  setOauthActive: (oauthActive) => set({ oauthActive }),
  markRecovered: () =>
    set({ phase: 'idle', busy: false, lastFailure: null, recoveredAt: Date.now() }),
  reset: () => set({ phase: 'idle', busy: false, lastFailure: null }),
}));
