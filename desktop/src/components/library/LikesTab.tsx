import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useInfiniteScroll, useLikedTracks} from '../../lib/hooks';
import {Loader2} from '../../lib/icons';
import {LIKED_ORDER_SCOPE, likesOrder} from '../../lib/likes-order';
import {armLikesContinuation} from '../../lib/queue-continuation';
import {filterTracks} from '../../lib/text-match';
import {sortTracks} from '../../lib/track-sort';
import {useAppMode} from '../../stores/app-status';
import {useSettingsStore} from '../../stores/settings';
import {GripSpace} from '../ui/SortableVirtualList';
import {SyncNotice, type SyncNoticeKind, syncNoticeOf} from '../ui/SyncNotice';
import {VirtualList} from '../ui/VirtualList';
import {LibraryTrackRow} from './LibraryTrackRow';
import {OrderableTracks} from './OrderableTracks';

const GRIP_SPACE = <GripSpace/>;

const LIKES_NOTICE_TEXT: Partial<Record<SyncNoticeKind, string>> = {
    failed: 'library.likesLoadFailed',
    syncing: 'library.likesSyncing',
};

export const LikesTab = React.memo(function LikesTab({filter}: { filter: string }) {
    const {t, i18n} = useTranslation();
    const sort = useSettingsStore((s) => s.likesSort);
    const sorted = sort !== 'default';
    const online = useAppMode() === 'online';
    const likesQuery = useLikedTracks();
    const {tracks: likedTracks, isLoading, syncInfo} = likesQuery;
    const sentinelRef = useInfiniteScroll(
        !!likesQuery.hasNextPage,
        !!likesQuery.isFetchingNextPage,
        likesQuery.fetchNextPage,
    );

    const loadAll = !!filter || sorted;
    const orderable = !loadAll && online;

    useEffect(() => {
        if (loadAll && likesQuery.hasNextPage && !likesQuery.isFetchingNextPage) {
            likesQuery.fetchNextPage();
        }
    }, [loadAll, likesQuery.hasNextPage, likesQuery.isFetchingNextPage]);

    const ordered = useMemo(
        () => sortTracks(likedTracks, sort, i18n.language),
        [likedTracks, sort, i18n.language],
    );

    const filtered = useMemo(() => filterTracks(ordered, filter), [ordered, filter]);

    const filteredRef = useRef(filtered);
    filteredRef.current = filtered;
    const getQueue = useCallback(() => filteredRef.current, []);

    const loadAllRef = useRef(loadAll);
    loadAllRef.current = loadAll;
    const onLikePlay = useCallback(() => {
        if (!loadAllRef.current) armLikesContinuation();
    }, []);

    const notice = syncNoticeOf({isError: likesQuery.isError && likedTracks.length === 0, syncInfo});
    const noticeKey = notice ? LIKES_NOTICE_TEXT[notice] : undefined;
    const noticeText = noticeKey ? t(noticeKey) : undefined;
    const retry = () => {
        void likesQuery.refetch();
    };

    return (
        <div className="min-h-[400px]" data-menu-scope={sorted ? undefined : LIKED_ORDER_SCOPE}>
            <div className="flex flex-col gap-1">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-ink-20"/>
                    </div>
                ) : filtered.length > 0 && orderable ? (
                    <OrderableTracks tracks={filtered} order={likesOrder} queue={getQueue} onPlay={onLikePlay}/>
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
                                onPlay={onLikePlay}
                                grip={GRIP_SPACE}
                            />
                        )}
                    />
                ) : filter ? (
                    <div className="py-20 text-center text-ink-20">
                        {likesQuery.hasNextPage ? t('common.loading') : t('library.noMatches')}
                    </div>
                ) : notice ? (
                    <div className="py-20">
                        <SyncNotice kind={notice} text={noticeText} info={syncInfo} ownedByMe onRetry={retry}/>
                    </div>
                ) : (
                    <div className="py-20 text-center text-ink-20">{t('library.noLikedTracks')}</div>
                )}
            </div>
            {!loadAll ? (
                <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
                    {likesQuery.isFetchingNextPage && (
                        <Loader2 size={20} className="text-ink-15 animate-spin"/>
                    )}
                </div>
            ) : likesQuery.isFetchingNextPage ? (
                <div className="h-12 flex items-center justify-center mt-4">
                    <Loader2 size={20} className="text-ink-15 animate-spin"/>
                </div>
            ) : null}
            {!loadAll && notice && likedTracks.length > 0 && !likesQuery.hasNextPage && (
                <div className="pb-6">
                    <SyncNotice kind={notice} text={noticeText} info={syncInfo} ownedByMe onRetry={retry}/>
                </div>
            )}
        </div>
    );
});
