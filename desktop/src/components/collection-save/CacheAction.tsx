import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BulkCacheProgress } from '../../lib/bulk-cache';
import { formatBytes } from '../../lib/formatters';
import { ArrowDownToLine, Check, Loader2, Lock, X } from '../../lib/icons';
import { ActionTile } from './ActionTile';

const LARGE_COLLECTION = 300;

function ProgressCard({
  progress,
  onCancel,
}: {
  progress: BulkCacheProgress | null;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const pct = progress && progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0;

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
          <div className="text-[12.5px] font-semibold text-white/90">
            {progress ? t('collectionSave.cacheProgress') : t('collectionSave.cachePreparing')}
          </div>
          {progress && progress.failed > 0 && (
            <div className="text-[11px] text-rose-300/80">
              {t('offline.failedCount', { count: progress.failed })}
            </div>
          )}
        </div>
        {progress && (
          <span
            className="font-mono text-[12px] font-semibold tabular-nums"
            style={{ color: 'var(--color-accent-hover)' }}
          >
            {progress.done} / {progress.total}
          </span>
        )}
        <button
          type="button"
          onClick={onCancel}
          title={t('common.cancel')}
          aria-label={t('common.cancel')}
          className="flex size-7 flex-none cursor-pointer items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/90"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

export const CacheAction = React.memo(function CacheAction({
  caching,
  busy,
  progress,
  saved,
  trackCount,
  estimatedBytes,
  onStart,
  onCancel,
}: {
  caching: boolean;
  busy: boolean;
  progress: BulkCacheProgress | null;
  saved: number | null;
  trackCount: number;
  estimatedBytes: number;
  onStart: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  if (caching) return <ProgressCard progress={progress} onCancel={onCancel} />;

  const complete = saved !== null && trackCount > 0 && saved >= trackCount;
  const partial = saved !== null && saved > 0 && !complete;
  const tracks = t('playlist.tracks', { count: trackCount });

  return (
    <ActionTile
      icon={complete ? <Check size={16} /> : <ArrowDownToLine size={16} />}
      accent={complete}
      title={
        complete
          ? t('collectionSave.cacheAllSaved')
          : partial
            ? t('collectionSave.cacheResume')
            : t('collectionSave.cacheTitle')
      }
      subtitle={
        complete
          ? t('collectionSave.cacheSavedSub', { tracks })
          : t('collectionSave.cacheSub', { tracks, size: formatBytes(estimatedBytes) })
      }
      badge={partial ? `${saved}/${trackCount}` : undefined}
      hint={
        busy
          ? t('collectionSave.busyHint')
          : !complete && trackCount > LARGE_COLLECTION
            ? t('collectionSave.largeHint')
            : undefined
      }
      footnote={
        <span className="inline-flex items-center gap-1">
          <Lock size={10} />
          {t('collectionSave.cacheProtected')}
        </span>
      }
      disabled={busy || trackCount === 0}
      onClick={onStart}
    />
  );
});
