import React from 'react';
import {useTranslation} from 'react-i18next';
import type {AuthStatus} from '../../lib/auth-status';
import {Clock, RotateCcw, Wifi, WifiOff} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';

/** Шапка: кикер + заголовок слева, единый статус сети / очередь синка справа. */
export const OfflineHead = React.memo(function OfflineHead({
  online,
  authStatus,
  onTryOnline,
}: {
  online: boolean;
  authStatus: AuthStatus | undefined;
  onTryOnline: () => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const pending = authStatus?.pendingSyncCount ?? 0;
  const failed = authStatus?.failedSyncCount ?? 0;

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-white/30">
          {t('offline.kicker')}
        </div>
        <h1 className="text-[30px] font-semibold leading-none tracking-[-0.04em] text-white/94 md:text-[34px]">
          {t('offline.title')}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {(pending > 0 || failed > 0) && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/18 bg-accent/[0.08] px-3 py-1.5 font-mono text-[10.5px] font-medium text-white/70 tabular-nums">
            <Clock size={11} />
            {t('offline.pendingCount', { count: pending })}
            {failed > 0 && (
              <span className="text-rose-300/80">
                · {t('offline.failedCount', { count: failed })}
              </span>
            )}
          </span>
        )}
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] ${
            online
              ? 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200/85'
              : 'border-sky-400/25 bg-sky-400/[0.07] text-sky-200/85'
          }`}
        >
          <span
            className="off-anim size-1.5 rounded-full bg-current"
            style={{
              animation:
                online && perf.idleAnim ? 'off-pulse 2.2s ease-in-out -0.4s infinite' : undefined,
            }}
          />
          {online ? <Wifi size={11} /> : <WifiOff size={11} />}
          {online ? t('offline.netOnline') : t('offline.netOffline')}
        </span>
        {!online && (
          <button
            type="button"
            onClick={onTryOnline}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-semibold text-white/75 transition-colors hover:border-white/[0.16] hover:bg-white/[0.09] hover:text-white/95"
          >
            <RotateCcw size={12} />
            {t('offline.tryOnline')}
          </button>
        )}
      </div>
    </header>
  );
});
