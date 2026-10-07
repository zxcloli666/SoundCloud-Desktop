import React from 'react';
import { AlertCircle, Check, Clock, RefreshCw } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { type SyncState, type SyncStatus, useSyncStatus } from '../../lib/sync-status';
import { useSyncCopy } from './useSyncCopy';

const TONE: Record<SyncState, string> = {
  synced: 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/80',
  syncing: 'border-accent/20 bg-accent/[0.08] text-white/75',
  delayed: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-100/85',
  failed: 'border-rose-400/25 bg-rose-400/[0.08] text-rose-200/85',
};

function StateIcon({ state }: { state: SyncState }) {
  const perf = usePerfMode();
  if (state === 'synced') return <Check size={11} />;
  if (state === 'delayed') return <Clock size={11} />;
  if (state === 'failed') return <AlertCircle size={11} />;
  return (
    <RefreshCw
      size={11}
      className={perf.idleAnim ? 'animate-spin [animation-duration:2.4s]' : undefined}
    />
  );
}

export const SyncStatusBadge = React.memo(function SyncStatusBadge({
  status,
  className = '',
}: {
  status: SyncStatus;
  className?: string;
}) {
  const { state, label, hint } = useSyncCopy(status);
  return (
    <span
      title={hint}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10.5px] font-medium tabular-nums transition-colors duration-300 ${TONE[state]} ${className}`}
    >
      <StateIcon state={state} />
      {label}
    </span>
  );
});

export const SyncStatusChip = React.memo(function SyncStatusChip({
  enabled = true,
  className,
}: {
  enabled?: boolean;
  className?: string;
}) {
  const { data } = useSyncStatus({ enabled });
  if (!data) return null;
  return <SyncStatusBadge status={data} className={className} />;
});
