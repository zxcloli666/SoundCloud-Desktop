import { useTranslation } from 'react-i18next';
import { type SyncState, type SyncStatus, syncStateOf } from '../../lib/sync-status';

const HOUR_THRESHOLD_SEC = 90 * 60;

export interface SyncCopy {
  state: SyncState;
  label: string;
  hint: string;
}

export function useSyncCopy(status: SyncStatus): SyncCopy {
  const { t } = useTranslation();
  const state = syncStateOf(status);
  const sec = status.retryInSec;
  const retry =
    sec == null || sec < 60
      ? t('sync.retrySoon')
      : sec < HOUR_THRESHOLD_SEC
        ? t('sync.retryMinutes', { count: Math.ceil(sec / 60) })
        : t('sync.retryHours', { count: Math.round(sec / 3600) });

  switch (state) {
    case 'delayed':
      return {
        state,
        label: t('sync.chip.delayed', { time: retry }),
        hint: t('sync.hint.delayed', { count: status.delayedCount, time: retry }),
      };
    case 'failed':
      return {
        state,
        label: t('sync.chip.failed', { count: status.failedCount }),
        hint: t('sync.hint.failed'),
      };
    case 'syncing':
      return {
        state,
        label: t('sync.chip.syncing', { count: status.pendingCount }),
        hint: t('sync.hint.syncing'),
      };
    default:
      return { state, label: t('sync.chip.synced'), hint: t('sync.hint.synced') };
  }
}
