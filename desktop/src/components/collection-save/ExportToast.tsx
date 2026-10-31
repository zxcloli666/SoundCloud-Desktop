import { revealItemInDir } from '@tauri-apps/plugin-opener';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { cancelExport, type ExportJob, useExportJob } from '../../lib/collection-export';
import { Check, FolderInput, FolderOpen, Loader2, X } from '../../lib/icons';

const TOAST_ID = 'collection-export';
const LINGER_MS = 12_000;

function headline(job: ExportJob, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (job.status === 'failed') return t('collectionSave.exportFailed');
  if (job.status === 'cancelled') return t('collectionSave.exportCancelled');
  if (job.status === 'done') {
    const ok = job.done - job.failed;
    return job.failed > 0
      ? t('collectionSave.exportDoneFailed', { ok, total: job.total, failed: job.failed })
      : t('collectionSave.exportDone', { ok, total: job.total });
  }
  if (job.cancelling) return t('collectionSave.exportStopping');
  if (job.status === 'preparing') return t('collectionSave.cachePreparing');
  return t('collectionSave.exportProgress');
}

function StatusIcon({ job }: { job: ExportJob }) {
  if (job.status === 'done' && job.failed === 0) return <Check size={16} />;
  if (job.status === 'preparing' || job.status === 'running') {
    return <Loader2 size={16} className="animate-spin" />;
  }
  return <FolderInput size={16} />;
}

const ExportToastCard = React.memo(function ExportToastCard({
  toastId,
}: {
  toastId: string | number;
}) {
  const { t } = useTranslation();
  const job = useExportJob((s) => s.job);
  const finished = job !== null && job.status !== 'preparing' && job.status !== 'running';

  useEffect(() => {
    if (!finished) return;
    const timer = window.setTimeout(() => toast.dismiss(toastId), LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [finished, toastId]);

  if (!job) return null;
  const pct = job.total > 0 ? Math.min(1, job.done / job.total) : 0;
  const success = job.status === 'done' && job.failed === 0;

  return (
    <div
      className="w-[356px] overflow-hidden rounded-2xl border border-ink/[0.08] text-ink"
      style={{
        background: 'rgb(var(--surface-hi) / 0.94)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        boxShadow: '0 20px 60px rgb(var(--shade) / calc(0.5 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-3">
        <span
          className={`mt-0.5 flex size-9 flex-none items-center justify-center rounded-[11px] ${
            success ? 'bg-accent/15 text-accent' : 'bg-ink/[0.06] text-ink-75'
          }`}
          style={success ? { boxShadow: '0 0 18px var(--color-accent-glow)' } : undefined}
        >
          <StatusIcon job={job} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink-92">{headline(job, t)}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-45">
            <span className="truncate">{job.title}</span>
            <span className="flex-none rounded-[5px] bg-ink/[0.06] px-1.5 py-px font-mono text-[10px] font-semibold uppercase text-ink-55">
              {job.format}
            </span>
          </div>
          {job.skipped > 0 && (
            <div className="mt-1 text-[11px] text-ink-35">
              {t('collectionSave.exportSkipped', { count: job.skipped })}
            </div>
          )}
        </div>
        {job.status === 'running' && (
          <span
            className="font-mono text-[12px] font-semibold tabular-nums"
            style={{ color: 'var(--color-accent-hover)' }}
          >
            {job.done} / {job.total}
          </span>
        )}
        {finished && (
          <button
            type="button"
            onClick={() => toast.dismiss(toastId)}
            aria-label={t('common.close')}
            className="flex size-6 flex-none cursor-pointer items-center justify-center rounded-full text-ink-40 transition-colors hover:bg-ink/[0.08] hover:text-ink-85"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {!finished && (
        <div className="mx-4 mb-3 h-[3px] overflow-hidden rounded-full bg-ink/[0.07]">
          <span
            className="block h-full origin-left"
            style={{
              transform: `scaleX(${pct})`,
              background: 'linear-gradient(90deg, var(--color-accent-glow), var(--color-accent))',
              transition: 'transform 400ms var(--ease-apple)',
            }}
          />
        </div>
      )}

      <div className="flex justify-end gap-1.5 border-t border-ink/[0.06] px-3 py-2">
        {!finished && !job.cancelling && (
          <button
            type="button"
            onClick={cancelExport}
            className="cursor-pointer rounded-[9px] px-3 py-1.5 text-[12px] font-semibold text-ink-55 transition-colors hover:bg-ink/[0.06] hover:text-ink-90"
          >
            {t('common.cancel')}
          </button>
        )}
        {job.firstPath && (
          <button
            type="button"
            onClick={() => void revealItemInDir(job.firstPath as string).catch(() => {})}
            className="flex cursor-pointer items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.07] hover:text-ink"
          >
            <FolderOpen size={13} />
            {t('collectionSave.showInFolder')}
          </button>
        )}
      </div>
    </div>
  );
});

export function showExportToast() {
  toast.custom((id) => <ExportToastCard toastId={id} />, {
    id: TOAST_ID,
    duration: Number.POSITIVE_INFINITY,
    unstyled: true,
  });
}
