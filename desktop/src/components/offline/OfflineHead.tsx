import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../lib/formatters';
import { useHostStatusStore } from '../../lib/host-status';
import { Activity, RotateCcw, Wifi, WifiOff } from '../../lib/icons';
import { useNetCheckStore } from '../../lib/net/check';
import { useAppStatusStore } from '../../stores/app-status';
import { SyncStatusChip } from '../sync/SyncStatusChip';

function OfflineStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="min-w-[72px]">
      <div className="text-[24px] font-semibold leading-none tracking-[-0.04em] text-ink-92">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-ink-40">{label}</div>
    </div>
  );
}

function useOfflineLabel(): string {
  const { t } = useTranslation();
  const bypass = useAppStatusStore((s) => s.offlineBypass);
  const navigatorOnline = useAppStatusStore((s) => s.navigatorOnline);
  const net = useHostStatusStore((s) => s.net);
  if (bypass) return t('offline.netChosen');
  if (!navigatorOnline || net === 'no-internet') return t('offline.netNoInternet');
  return t('offline.netServerDown');
}

export const OfflineHead = React.memo(function OfflineHead({
  online,
  onTryOnline,
  stats,
}: {
  online: boolean;
  onTryOnline: () => void;
  stats: { cachedCount: number; likedCachedCount: number; totalBytes: number };
}) {
  const { t } = useTranslation();
  const offlineLabel = useOfflineLabel();
  const probing = useHostStatusStore((s) => s.probing);

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[30px] font-semibold leading-none tracking-[-0.04em] text-ink-94 md:text-[34px]">
          {t('offline.title')}
        </h1>
        <div className="mt-4 flex flex-wrap gap-8">
          <OfflineStat value={stats.cachedCount} label={t('offline.cachedTitle')} />
          <OfflineStat value={stats.likedCachedCount} label={t('offline.likesTitle')} />
          <OfflineStat value={formatBytes(stats.totalBytes)} label={t('offline.storeTitle')} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SyncStatusChip enabled={online} />
        <span className="chip-pill">
          <span
            className={`off-anim size-1.5 rounded-full ${online ? 'bg-accent' : 'bg-ink/40'}`}
            style={{
              animation: online ? 'off-pulse 2.2s ease-in-out -0.4s infinite' : undefined,
            }}
          />
          {online ? <Wifi size={11} /> : <WifiOff size={11} />}
          {online ? t('offline.netOnline') : offlineLabel}
        </span>
        {!online && (
          <button
            type="button"
            onClick={onTryOnline}
            disabled={probing}
            className="chip-pill disabled:cursor-default disabled:opacity-50"
          >
            <RotateCcw size={12} className={probing ? 'animate-spin' : undefined} />
            {t('offline.tryOnline')}
          </button>
        )}
        {!online && (
          <button
            type="button"
            onClick={() => useNetCheckStore.getState().openCheck()}
            className="chip-pill"
          >
            <Activity size={12} />
            {t('netCheck.open')}
          </button>
        )}
      </div>
    </header>
  );
});
