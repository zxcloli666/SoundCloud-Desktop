import * as Popover from '@radix-ui/react-popover';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type BulkCacheProgress, bulkCacheErrorText, useBulkCache } from '../../lib/bulk-cache';
import { ArrowDownToLine, Check } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import type { Track } from '../../stores/player';
import { CacheAction } from './CacheAction';
import { estimateBytes, useSavedCoverage } from './coverage';
import { ProgressRing } from './ProgressRing';

export interface SaveCollectionProps {
  scope: string;
  title: string;
  tracks: Track[];
  trackCount: number;
  collect: () => Promise<Track[]>;
  variant: 'rail' | 'pill';
}

function useFinishToast(refresh: () => void) {
  const { t } = useTranslation();
  return useCallback(
    (p: BulkCacheProgress) => {
      refresh();
      if (p.phase === 'cancelled') {
        toast(t('collectionSave.cacheCancelled'));
        return;
      }
      const ok = p.done - p.failed;
      if (p.failed > 0) {
        toast.warning(
          t('collectionSave.cacheDoneFailed', { ok, total: p.total, failed: p.failed }),
        );
      } else {
        toast.success(t('collectionSave.cacheDone', { ok, total: p.total }));
      }
    },
    [refresh, t],
  );
}

export const SaveCollectionMenu = React.memo(function SaveCollectionMenu({
  scope,
  title,
  tracks,
  trackCount,
  collect,
  variant,
}: SaveCollectionProps) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const [open, setOpen] = useState(false);
  const coverage = useSavedCoverage(tracks);
  const onFinish = useFinishToast(() => void coverage.refresh());
  const bulk = useBulkCache(scope, collect, onFinish);
  const total = Math.max(trackCount, tracks.length);
  const estimated = useMemo(() => estimateBytes(tracks, total), [tracks, total]);

  useEffect(() => {
    void coverage.refresh();
  }, [coverage.refresh]);

  const startCache = useCallback(() => {
    void bulk.start().then(
      (queued) => {
        if (queued === 0) toast(t('collectionSave.empty'));
      },
      (err) => toast.error(bulkCacheErrorText(err)),
    );
  }, [bulk.start, t]);

  const pct =
    bulk.progress && bulk.progress.total > 0 ? bulk.progress.done / bulk.progress.total : 0;
  const complete = coverage.saved !== null && total > 0 && coverage.saved >= total;
  const label = bulk.caching
    ? t('collectionSave.cacheProgress')
    : complete
      ? t('collectionSave.cacheAllSaved')
      : t('collectionSave.menuLabel');
  const icon = complete && !bulk.caching ? <Check size={16} /> : <ArrowDownToLine size={16} />;
  const blur = perf.blur(30);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {variant === 'rail' ? (
          <button
            type="button"
            title={label}
            aria-label={label}
            className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
              bulk.caching || complete
                ? 'text-accent bg-accent/12'
                : 'text-white/60 hover:text-white/95 hover:bg-white/[0.07]'
            }`}
          >
            {bulk.caching && <ProgressRing value={pct} size={34} />}
            {icon}
          </button>
        ) : (
          <button
            type="button"
            title={label}
            className={`relative inline-flex items-center gap-2 h-11 pl-3 pr-4 rounded-full text-[12.5px] font-semibold border transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer active:scale-[0.96] ${
              bulk.caching || complete
                ? 'bg-accent/12 text-accent border-accent/30'
                : 'bg-white/[0.04] border-white/[0.08] text-white/70 hover:bg-white/[0.07] hover:text-white/95'
            }`}
          >
            <span className="relative flex size-7 items-center justify-center">
              {bulk.caching && <ProgressRing value={pct} size={28} />}
              {icon}
            </span>
            {bulk.caching && bulk.progress
              ? `${bulk.progress.done} / ${bulk.progress.total}`
              : t('collectionSave.pillLabel')}
          </button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={10}
          align="center"
          collisionPadding={16}
          className="z-50 w-[320px] rounded-[20px] p-2 outline-none animate-fade-in-up"
          style={{
            background: blur > 0 ? 'rgba(18,18,22,0.9)' : 'rgb(22,22,26)',
            backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.8)` : undefined,
            WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.8)` : undefined,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className="px-2.5 pt-2 pb-2.5">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
              {t('collectionSave.kicker')}
            </div>
            <div className="mt-1 truncate text-[14px] font-bold text-white/90">{title}</div>
          </div>
          <div className="flex flex-col gap-1.5">
            <CacheAction
              caching={bulk.caching}
              busy={bulk.busyScope !== null}
              progress={bulk.progress}
              saved={coverage.saved}
              trackCount={total}
              estimatedBytes={estimated}
              onStart={startCache}
              onCancel={bulk.cancel}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
