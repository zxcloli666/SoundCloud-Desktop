import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { bulkCacheErrorText, useCacheLikes } from '../../../lib/bulk-cache';
import { Download, X } from '../../../lib/icons';
import { Row } from '../primitives';

export function CacheLikesRow({ onProgress }: { onProgress: () => void }) {
  const { t } = useTranslation();
  const { caching, progress, start, cancel } = useCacheLikes((p) => {
    onProgress();
    if (p.phase === 'done') {
      toast.success(t('settings.cacheLikesDone', { done: p.done - p.failed, total: p.total }));
    }
  });

  const run = useCallback(async () => {
    try {
      const queued = await start();
      if (queued === 0) toast(t('settings.cacheLikesEmpty'));
    } catch (err) {
      toast.error(bulkCacheErrorText(err));
    }
  }, [start, t]);

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

  const status = caching ? (
    <>
      <span className="flex items-center gap-2 tabular-nums">
        {progress
          ? t('settings.cacheLikesProgress', { done: progress.done, total: progress.total })
          : t('settings.cacheLikesStarting')}
        {progress && progress.failed > 0 && (
          <span className="text-bad">
            {t('settings.cacheLikesFailed', { count: progress.failed })}
          </span>
        )}
      </span>
      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-ink/[0.08]">
        <span
          className="block h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </span>
    </>
  ) : (
    t('settings.cacheLikesDesc')
  );

  return (
    <Row title={t('settings.cacheLikes')} desc={status}>
      {caching ? (
        <button type="button" onClick={cancel} className="set-btn">
          <X size={13} />
          {t('common.cancel')}
        </button>
      ) : (
        <button type="button" onClick={run} className="set-btn">
          <Download size={13} />
          {t('settings.download')}
        </button>
      )}
    </Row>
  );
}
