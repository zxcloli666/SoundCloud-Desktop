import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from '../../lib/icons';

export interface ProgressCounts {
  done: number;
  total: number;
  failed: number;
}

export const ProgressCard = React.memo(function ProgressCard({
  label,
  counts,
  onCancel,
}: {
  label: string;
  counts: ProgressCounts | null;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const pct = counts && counts.total > 0 ? Math.min(1, counts.done / counts.total) : 0;

  return (
    <div
      className="relative overflow-hidden rounded-[14px] border px-3.5 py-3"
      style={{ borderColor: 'var(--color-accent-glow)', background: 'rgba(255,255,255,0.02)' }}
    >
      <span
        className="absolute inset-0 origin-left"
        style={{
          transform: `scaleX(${pct})`,
          background:
            'linear-gradient(90deg, var(--color-accent-glow), var(--color-accent-selection))',
          transition: 'transform 400ms var(--ease-apple)',
        }}
      />
      <div className="relative flex items-center gap-2.5">
        <Loader2
          size={14}
          className="animate-spin"
          style={{ color: 'var(--color-accent-hover)' }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-semibold text-white/90">{label}</div>
          {counts && counts.failed > 0 && (
            <div className="text-[11px] text-rose-300/80">
              {t('offline.failedCount', { count: counts.failed })}
            </div>
          )}
        </div>
        {counts && counts.total > 0 && (
          <span
            className="font-mono text-[12px] font-semibold tabular-nums"
            style={{ color: 'var(--color-accent-hover)' }}
          >
            {counts.done} / {counts.total}
          </span>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            title={t('common.cancel')}
            aria-label={t('common.cancel')}
            className="flex size-7 flex-none cursor-pointer items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/90"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
});
