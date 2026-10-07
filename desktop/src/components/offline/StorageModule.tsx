import React from 'react';
import {useTranslation} from 'react-i18next';
import type {BulkCacheProgress} from '../../lib/bulk-cache';
import {isAudioCacheOff} from '../../lib/cache-limit';
import {formatBytes} from '../../lib/formatters';
import {ArrowDownToLine, Check, Lock, X} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import {useSettingsStore} from '../../stores/settings';

const TICKS =
  'repeating-linear-gradient(90deg, transparent 0, transparent calc(12.5% - 1px), rgba(10,10,12,0.9) calc(12.5% - 1px), rgba(10,10,12,0.9) 12.5%)';
const HATCH = 'repeating-linear-gradient(-45deg, rgba(10,10,12,0.5) 0 4px, transparent 4px 8px)';

function CacheLikesCta({
  caching,
  progress,
  remaining,
  onStart,
  onCancel,
}: {
  caching: boolean;
  progress: BulkCacheProgress | null;
  remaining: number;
  onStart: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();

  if (!caching) {
    if (remaining === 0) {
      return (
        <div className="flex h-10 items-center gap-2 text-[12px] font-medium text-emerald-200/70">
          <Check size={13} />
          {t('offline.likesAllCached')}
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={onStart}
        className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-[11px] border px-3.5 transition-colors"
        style={{ borderColor: 'var(--color-accent-glow)', background: 'rgba(255,255,255,0.02)' }}
      >
        <ArrowDownToLine size={13} style={{ color: 'var(--color-accent-hover)' }} />
        <span className="text-[12.5px] font-semibold text-white/85">
          {t('offline.ctaCacheLikes')}
        </span>
        <span
          className="ml-auto font-mono text-[12px] font-semibold tabular-nums"
          style={{ color: 'var(--color-accent-hover)' }}
        >
          {remaining}
        </span>
      </button>
    );
  }

  const pct = progress && progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0;
  return (
    <div>
      <div
        className="relative flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-[11px] border px-3.5"
        style={{ borderColor: 'var(--color-accent-glow)' }}
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
        {perf.idleAnim && (
          <span
            className="off-anim absolute bottom-0 left-[-40%] top-0 w-[36%]"
            style={{
              background:
                'linear-gradient(100deg, transparent, rgba(255,255,255,0.07), transparent)',
              animation: 'off-sheen 2.6s ease-in-out -0.9s infinite',
            }}
          />
        )}
        <span className="relative flex items-center gap-2 text-[12.5px] font-semibold text-white/90">
          <span
            className="off-anim size-1.5 rounded-full"
            style={{
              background: 'var(--color-accent-hover)',
              animation: perf.idleAnim ? 'off-pulse 1.6s ease-in-out infinite' : undefined,
            }}
          />
          {progress ? t('offline.ctaCaching') : t('offline.ctaStarting')}
        </span>
        {progress && (
          <span
            className="relative ml-auto font-mono text-[12px] font-semibold tabular-nums"
            style={{ color: 'var(--color-accent-hover)' }}
          >
            {progress.done} / {progress.total}
          </span>
        )}
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('common.cancel')}
          className="relative flex size-6 flex-none cursor-pointer items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white/85"
        >
          <X size={12} />
        </button>
      </div>
      {progress && progress.failed > 0 && (
        <div className="mt-2 flex justify-between font-mono text-[10.5px] tracking-[0.03em] text-white/30">
          <span>{t('offline.ctaPhase')}</span>
          <span className="text-rose-300/80">
            {t('offline.failedCount', { count: progress.failed })}
          </span>
        </div>
      )}
    </div>
  );
}

/** Правый модуль hero: объём хранилища с защищённой квотой лайков + покрытие
 *  лайков и CTA «скачать все лайки». */
export const StorageModule = React.memo(function StorageModule({
  totalBytes,
  likedBytes,
  fileCount,
  likedCount,
  likedCachedCount,
  caching,
  progress,
  onStartLikes,
  onCancelLikes,
}: {
  totalBytes: number;
  likedBytes: number;
  fileCount: number;
  likedCount: number;
  likedCachedCount: number;
  caching: boolean;
  progress: BulkCacheProgress | null;
  onStartLikes: () => void;
  onCancelLikes: () => void;
}) {
  const { t } = useTranslation();
  const limitMb = useSettingsStore((s) => s.audioCacheLimitMB);
  const limitBytes = limitMb > 0 ? limitMb * 1024 * 1024 : null;

  const denom = Math.max(limitBytes ?? totalBytes, 1);
  const likedPct = Math.min(100, (likedBytes / denom) * 100);
  const cachePct = Math.min(100 - likedPct, ((totalBytes - likedBytes) / denom) * 100);
  const freeBytes = limitBytes !== null ? Math.max(0, limitBytes - totalBytes) : null;
  const coveragePct = likedCount > 0 ? likedCachedCount / likedCount : 0;

  return (
    <div className="flex min-w-0 flex-col px-5 py-5 md:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
          {t('offline.storeTitle')}
        </span>
        <span className="font-mono text-[11px] text-white/30 tabular-nums">
          {t('offline.fileCount', { count: fileCount })}
        </span>
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] text-white/92 tabular-nums">
          {formatBytes(totalBytes)}
        </span>
        <span className="font-mono text-[12px] text-white/40">
          {isAudioCacheOff(limitMb)
            ? t('offline.storeCacheOff')
            : limitBytes !== null
              ? t('offline.storeOfLimit', { limit: formatBytes(limitBytes) })
              : t('offline.storeNoLimit')}
        </span>
      </div>

      <div className="relative mt-3 h-[10px] overflow-hidden rounded-[5px] bg-white/[0.05]">
        <span
          className="absolute bottom-0 top-0"
          style={{
            left: 0,
            width: `${likedPct}%`,
            background: 'var(--color-accent)',
            opacity: 0.85,
          }}
        >
          <span className="absolute inset-0" style={{ background: HATCH }} />
        </span>
        <span
          className="absolute bottom-0 top-0 bg-white/[0.32]"
          style={{ left: `${likedPct}%`, width: `${cachePct}%` }}
        />
        <span className="absolute inset-0" style={{ background: TICKS }} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10.5px] leading-relaxed text-white/45">
        <span className="flex items-center gap-1.5">
          <Lock size={9} className="opacity-70" />
          {t('offline.legendLikes', { size: formatBytes(likedBytes) })}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-[2px] bg-white/[0.3]" />
          {t('offline.legendCache', { size: formatBytes(Math.max(0, totalBytes - likedBytes)) })}
        </span>
        {freeBytes !== null && (
          <span className="ml-auto text-white/30">
            {t('offline.legendFree', { size: formatBytes(freeBytes) })}
          </span>
        )}
      </div>

      {likedCount > 0 && (
        <div className="mt-auto border-t border-white/[0.06] pt-3.5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[12.5px] font-medium text-white/55">
              {t('offline.likesCoverage')}
            </span>
            <span className="font-mono text-[12px] font-semibold tabular-nums text-white/90">
              {likedCachedCount}{' '}
              <span className="font-normal text-white/35">
                {t('offline.coverageOf', { total: likedCount })}
              </span>
            </span>
          </div>
          <div className="mb-3 h-[3px] overflow-hidden rounded-[2px] bg-white/[0.07]">
            <span
              className="block h-full origin-left"
              style={{
                transform: `scaleX(${coveragePct})`,
                background: 'linear-gradient(90deg, var(--color-accent-glow), var(--color-accent))',
                transition: 'transform 400ms var(--ease-apple)',
              }}
            />
          </div>
          <CacheLikesCta
            caching={caching}
            progress={progress}
            remaining={Math.max(0, likedCount - likedCachedCount)}
            onStart={onStartLikes}
            onCancel={onCancelLikes}
          />
        </div>
      )}
    </div>
  );
});
