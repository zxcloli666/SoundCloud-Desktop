import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useInfiniteScroll } from '../../../lib/hooks';
import { Loader2 } from '../../../lib/icons';
import { armSuperlikesContinuation } from '../../../lib/queue-continuation';
import { SUPERLIKED_ORDER_SCOPE, superlikesOrder } from '../../../lib/superlikes-order';
import { useSuperlikeQuota, useSuperlikedTracks } from '../../../lib/superlikes';
import { filterTracks } from '../../../lib/text-match';
import { useAppMode } from '../../../stores/app-status';
import { GripSpace } from '../../ui/SortableVirtualList';
import { SyncNotice } from '../../ui/SyncNotice';
import { VirtualList } from '../../ui/VirtualList';
import { LibraryTrackRow } from '../LibraryTrackRow';
import { OrderableTracks } from '../OrderableTracks';
import { SuperlikesEmpty } from './SuperlikesEmpty';
import { SuperlikesHero } from './SuperlikesHero';
import { usePlaySuperlikes } from './usePlaySuperlikes';

const GRIP_SPACE = <GripSpace />;

export const SuperlikesTab = React.memo(function SuperlikesTab({ filter }: { filter: string }) {
  const { t } = useTranslation();
  const online = useAppMode() === 'online';
  const query = useSuperlikedTracks();
  const { data: quota } = useSuperlikeQuota();
  const { tracks, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const sentinelRef = useInfiniteScroll(!!hasNextPage, isFetchingNextPage, fetchNextPage);
  const player = usePlaySuperlikes(query);

  useEffect(() => {
    if (filter && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [filter, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const filtered = useMemo(() => filterTracks(tracks, filter), [tracks, filter]);
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;
  const getQueue = useCallback(() => filteredRef.current, []);
  const onPlay = filter ? undefined : armSuperlikesContinuation;

  const hero = (
    <SuperlikesHero
      quota={quota}
      canPlay={tracks.length > 0}
      loading={player.loading}
      onPlay={player.playAll}
      onShuffle={player.shuffle}
    />
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-ink-20" />
      </div>
    );
  }

  if (query.isError && tracks.length === 0) {
    return (
      <div className="py-20">
        <SyncNotice
          kind="failed"
          text={t('superlikes.loadFailed')}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <>
        {hero}
        <SuperlikesEmpty />
      </>
    );
  }

  return (
    <div className="min-h-[400px]" data-menu-scope={filter ? undefined : SUPERLIKED_ORDER_SCOPE}>
      {hero}
      {filtered.length > 0 && !filter && online ? (
        <OrderableTracks
          tracks={filtered}
          order={superlikesOrder}
          queue={getQueue}
          onPlay={onPlay}
        />
      ) : filtered.length > 0 ? (
        <VirtualList
          items={filtered}
          rowHeight={68}
          overscan={8}
          className="flex flex-col gap-1"
          disabled={filtered.length < 40}
          getItemKey={(track) => track.urn}
          renderItem={(track, i) => (
            <LibraryTrackRow
              track={track}
              index={i}
              queue={getQueue}
              onPlay={onPlay}
              grip={GRIP_SPACE}
            />
          )}
        />
      ) : (
        <div className="py-20 text-center text-ink-20">
          {hasNextPage ? t('common.loading') : t('library.noMatches')}
        </div>
      )}
      <div ref={sentinelRef} className="mt-4 flex h-12 items-center justify-center">
        {isFetchingNextPage && <Loader2 size={20} className="animate-spin text-ink-15" />}
      </div>
    </div>
  );
});
