import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from '../../lib/icons';
import { useSyncStatus } from '../../lib/sync-status';

export const SyncQueueChip = React.memo(function SyncQueueChip({
  enabled = true,
}: {
  enabled?: boolean;
}) {
  const { t } = useTranslation();
  const { data } = useSyncStatus({ enabled });
  const pending = data?.pendingCount ?? 0;
  const failed = data?.failedCount ?? 0;

  if (pending === 0 && failed === 0) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/18 bg-accent/[0.08] px-3 py-1.5 font-mono text-[10.5px] font-medium text-white/70 tabular-nums">
      <Clock size={11} />
      {t('offline.pendingCount', { count: pending })}
      {failed > 0 && (
        <span className="text-rose-300/80">· {t('offline.failedCount', { count: failed })}</span>
      )}
    </span>
  );
});
