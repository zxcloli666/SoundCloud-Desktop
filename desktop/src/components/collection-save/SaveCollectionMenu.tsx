import * as Popover from '@radix-ui/react-popover';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { type BulkCacheProgress, bulkCacheErrorText, useBulkCache } from '../../lib/bulk-cache';
import { type OfflineCollectionMeta, rememberCollection } from '../../lib/offline-index';
import { usePerfMode } from '../../lib/perf';
import type { Track } from '../../stores/player';
import { CacheAction } from './CacheAction';
import { estimateBytes, useSavedCoverage } from './coverage';
import { ExportAction } from './ExportAction';
import { SaveTrigger } from './SaveTrigger';
import { useCollectionExport } from './useCollectionExport';

export interface SaveCollectionProps {
  scope: string;
  meta: OfflineCollectionMeta;
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
  meta,
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
  const collectForOffline = useCallback(async () => {
    const collected = await collect();
    await rememberCollection(scope, meta, collected);
    return collected;
  }, [collect, scope, meta]);
  const bulk = useBulkCache(scope, collectForOffline, onFinish);
  const exporter = useCollectionExport(scope, meta.title, collect, open);
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

  const activity = bulk.caching
    ? (bulk.progress ?? { done: 0, total: 0 })
    : exporter.job
      ? { done: exporter.job.done, total: exporter.job.total }
      : null;
  const complete = coverage.saved !== null && total > 0 && coverage.saved >= total;
  const label = bulk.caching
    ? t('collectionSave.cacheProgress')
    : exporter.job
      ? t('collectionSave.exportProgress')
      : complete
        ? t('collectionSave.cacheAllSaved')
        : t('collectionSave.menuLabel');
  const blur = perf.blur(30);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <SaveTrigger variant={variant} label={label} activity={activity} complete={complete} />
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
            <div className="mt-1 truncate text-[14px] font-bold text-white/90">{meta.title}</div>
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
            <div className="mx-2 my-1 h-px bg-white/[0.06]" />
            <ExportAction
              job={exporter.job}
              busy={exporter.busy}
              format={exporter.format}
              mp3Supported={exporter.mp3Supported}
              onFormat={exporter.setFormat}
              onStart={() => {
                setOpen(false);
                void exporter.start();
              }}
              onCancel={exporter.cancel}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
