import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SyncWait } from '../../lib/collection-sync';
import { ArrowDownToLine, ListEnd, Zap } from '../../lib/icons';
import { WaitClock } from './WaitClock';

export const WaitProgress = memo(function WaitProgress({
  wait,
  at,
  synced,
}: {
  wait: SyncWait | null;
  at: number;
  synced: number | null;
}) {
  const { t } = useTranslation();
  if (!wait && synced === null) return null;

  return (
    <span data-ui="sync-wait-progress" className="flex shrink-0 items-center gap-3 text-[12px]">
      {wait && (
        <span
          data-lane={wait.lane}
          title={t(`syncWait.lane.${wait.lane}`)}
          className={`flex items-center gap-1.5 ${wait.lane === 'read' ? 'text-accent' : 'text-ink-55'}`}
        >
          {wait.lane === 'read' ? <Zap size={13} /> : <ListEnd size={13} />}
          {wait.ahead > 0 && (
            <span className="font-mono tabular-nums">
              {t('syncWait.ahead', { count: wait.ahead })}
            </span>
          )}
          <WaitClock
            until={at + wait.etaSeconds * 1000}
            className="font-mono text-ink-45 tabular-nums"
          />
        </span>
      )}
      {synced !== null && (
        <span
          title={t('syncWait.saved')}
          className="flex items-center gap-1.5 text-ink-55 tabular-nums"
        >
          <ArrowDownToLine size={13} />
          <span key={synced} className="sync-wait-fade font-mono">
            {synced.toLocaleString()}
          </span>
        </span>
      )}
    </span>
  );
});
