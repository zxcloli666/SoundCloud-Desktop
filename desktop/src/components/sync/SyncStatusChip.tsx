import React from 'react';
import { AlertCircle, Check, Clock, Lock, RefreshCw } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { type SyncState, type SyncStatus, syncStateOf, useSyncStatus } from '../../lib/sync-status';
import { useSyncCopy } from './useSyncCopy';

const TONE: Record<SyncState, string> = {
  synced: 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/80',
  syncing: 'border-accent/20 bg-accent/[0.08] text-ink-75',
  delayed: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-100/85',
  failed: 'border-rose-400/25 bg-rose-400/[0.08] text-rose-200/85',
  dead: 'border-rose-400/30 bg-rose-400/[0.1] text-rose-100/90',
  relogin: 'border-amber-400/30 bg-amber-400/[0.1] text-amber-100/90',
};

const BADGE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10.5px] font-medium tabular-nums transition-colors duration-300';

function StateIcon({ state }: { state: SyncState }) {
  const perf = usePerfMode();
  if (state === 'synced') return <Check size={11} />;
  if (state === 'delayed') return <Clock size={11} />;
  if (state === 'relogin') return <Lock size={11} />;
  if (state === 'failed' || state === 'dead') return <AlertCircle size={11} />;
  return (
    <RefreshCw
      size={11}
      className={perf.idleAnim ? 'animate-spin [animation-duration:2.4s]' : undefined}
    />
  );
}

export const SyncStatusBadge = React.memo(function SyncStatusBadge({
  status,
  withAction = true,
  className = '',
}: {
  status: SyncStatus;
  withAction?: boolean;
  className?: string;
}) {
  const { state, label, hint, action } = useSyncCopy(status);

  if (withAction && action) {
    return (
      <button
        type="button"
        title={hint}
        onClick={action.run}
        disabled={action.disabled}
        className={`${BADGE} ${TONE[state]} cursor-pointer enabled:hover:border-ink/30 disabled:cursor-default disabled:opacity-60 ${className}`}
      >
        <StateIcon state={state} />
        {label}
        <span className="border-l border-ink/15 pl-1.5 font-semibold">{action.label}</span>
      </button>
    );
  }

  return (
    <span title={hint} className={`${BADGE} ${TONE[state]} ${className}`}>
      <StateIcon state={state} />
      {label}
    </span>
  );
});

export const SyncStatusChip = React.memo(function SyncStatusChip({
  enabled = true,
  quietWhenSynced = false,
  className,
}: {
  enabled?: boolean;
  quietWhenSynced?: boolean;
  className?: string;
}) {
  const { data } = useSyncStatus({ enabled });
  if (!data) return null;
  if (quietWhenSynced && syncStateOf(data) === 'synced') return null;
  return <SyncStatusBadge status={data} withAction={enabled} className={className} />;
});
