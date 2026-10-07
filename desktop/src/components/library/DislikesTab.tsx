import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDislikedTracks } from '../../lib/dislikes';
import { useInfiniteScroll } from '../../lib/hooks';
import { Loader2, ThumbsDown } from '../../lib/icons';
import { filterTracks } from '../../lib/text-match';
import { SyncNotice } from '../ui/SyncNotice';
import { VirtualList } from '../ui/VirtualList';
import { DislikedTrackRow } from './DislikedTrackRow';

export const DislikesTab = React.memo(function DislikesTab({ filter }: { filter: string }) {
  const { t } = useTranslation();
  const query = useDislikedTracks();
  const { tracks, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const sentinelRef = useInfiniteScroll(!!hasNextPage, isFetchingNextPage, fetchNextPage);

  useEffect(() => {
    if (filter && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [filter, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const filtered = useMemo(() => filterTracks(tracks, filter), [tracks, filter]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-white/20" />
      </div>
    );
  }

  if (query.isError && tracks.length === 0) {
    return (
      <div className="py-20">
        <SyncNotice
          kind="failed"
          text={t('dislikes.loadFailed')}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.06] flex items-center justify-center text-white/25">
          <ThumbsDown size={20} />
        </div>
        <p className="text-[14px] font-semibold text-white/60">{t('dislikes.empty')}</p>
        <p className="max-w-sm text-[12px] leading-relaxed text-white/30">{t('dislikes.hint')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[400px]">
      <p className="mb-4 px-1 text-[12px] leading-relaxed text-white/35">{t('dislikes.hint')}</p>
      {filtered.length > 0 ? (
        <VirtualList
          items={filtered}
          rowHeight={68}
          overscan={8}
          className="flex flex-col gap-1"
          disabled={filtered.length < 40}
          getItemKey={(track) => track.urn}
          renderItem={(track) => <DislikedTrackRow track={track} />}
        />
      ) : (
        <div className="py-20 text-center text-white/20">
          {hasNextPage ? t('common.loading') : t('library.noMatches')}
        </div>
      )}
      <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
        {isFetchingNextPage && <Loader2 size={20} className="text-white/15 animate-spin" />}
      </div>
    </div>
  );
});
