import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BulkCacheProgress } from '../../lib/bulk-cache';
import { formatBytes } from '../../lib/formatters';
import { ArrowDownToLine, Check, Lock } from '../../lib/icons';
import { ActionTile } from './ActionTile';
import { ProgressCard } from './ProgressCard';

const LARGE_COLLECTION = 300;

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

  if (caching) {
    return (
      <ProgressCard
        label={progress ? t('collectionSave.cacheProgress') : t('collectionSave.cachePreparing')}
        counts={progress}
        onCancel={onCancel}
      />
    );
  }

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
