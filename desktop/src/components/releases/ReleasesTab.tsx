import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines, Check, Sparkles } from '../../lib/icons';
import { RELEASE_DAYS } from '../../lib/new-releases';
import { useReleaseFeed } from '../../lib/new-releases-api';
import { usePremium } from '../../lib/premium-cache';
import { filterTracks } from '../../lib/text-match';
import { LibraryTrackRow } from '../library/LibraryTrackRow';
import { Skeleton } from '../ui/Skeleton';
import { SyncNotice } from '../ui/SyncNotice';
import { VirtualList } from '../ui/VirtualList';
import { ReleaseActions } from './ReleaseActions';
import { ReleasesLocked } from './ReleasesLocked';

function RowSkeletons() {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="size-8" rounded="full" />
          <Skeleton className="size-11" rounded="md" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-1/3" rounded="sm" />
            <Skeleton className="mt-1.5 h-3 w-1/5" rounded="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const ReleasesTab = memo(function ReleasesTab({ filter }: { filter: string }) {
  const { t } = useTranslation();
  const premium = usePremium();
  const { tracks, heard, unheard, query } = useReleaseFeed();
  const shown = useMemo(() => filterTracks(tracks, filter), [tracks, filter]);

  if (!premium) return <ReleasesLocked />;
  if (query.isLoading) return <RowSkeletons />;
  if (query.isError && tracks.length === 0) {
    return (
      <div className="py-20">
        <SyncNotice kind="failed" onRetry={() => void query.refetch()} />
      </div>
    );
  }
  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-ink/[0.04] text-ink-25">
          <AudioLines size={24} />
        </span>
        <p className="max-w-[320px] text-sm text-ink-40">
          {t('releases.empty', { count: RELEASE_DAYS })}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[400px]">
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[24px] border border-ink/[0.07] bg-ink/[0.03] px-5 py-4">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/25">
          <Sparkles size={18} />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-[14px] font-semibold text-ink-90">
            {t('releases.why', { count: RELEASE_DAYS })}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-45">
            <Check size={12} />
            {unheard > 0 ? t('releases.unheard', { count: unheard }) : t('releases.allHeard')}
          </p>
        </div>
        <ReleaseActions tracks={shown} />
      </div>
      <VirtualList
        items={shown}
        rowHeight={68}
        overscan={8}
        className="flex flex-col gap-1"
        disabled={shown.length < 40}
        getItemKey={(track) => track.urn}
        renderItem={(track, i) => (
          <div
            className={
              heard.has(track.urn) ? 'opacity-60 transition-opacity hover:opacity-100' : ''
            }
          >
            <LibraryTrackRow track={track} index={i} queue={shown} />
          </div>
        )}
      />
    </div>
  );
});
