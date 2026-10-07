import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {useInfiniteScroll, useLikedTracks} from '../../lib/hooks';
import {Loader2} from '../../lib/icons';
import {armLikesContinuation} from '../../lib/queue-continuation';
import {sortTracks} from '../../lib/track-sort';
import {useSettingsStore} from '../../stores/settings';
import {SyncNotice, syncNoticeOf} from '../ui/SyncNotice';
import {VirtualList} from '../ui/VirtualList';
import {LibraryTrackRow} from './LibraryTrackRow';

const LIKES_NOTICE_TEXT = {
    failed: 'library.likesLoadFailed',
    syncing: 'library.likesSyncing',
    stalled: 'library.likesSyncSlow',
} as const;

export const LikesTab = React.memo(function LikesTab({filter}: { filter: string }) {
    const {t, i18n} = useTranslation();
    const sort = useSettingsStore((s) => s.likesSort);
    const sorted = sort !== 'default';
    const likesQuery = useLikedTracks();
    const {tracks: likedTracks, isLoading, syncState} = likesQuery;
    const sentinelRef = useInfiniteScroll(
        !!likesQuery.hasNextPage,
        !!likesQuery.isFetchingNextPage,
        likesQuery.fetchNextPage,
    );

    const loadAll = !!filter || sorted;

    useEffect(() => {
        if (loadAll && likesQuery.hasNextPage && !likesQuery.isFetchingNextPage) {
            likesQuery.fetchNextPage();
        }
    }, [loadAll, likesQuery.hasNextPage, likesQuery.isFetchingNextPage]);

    const ordered = useMemo(
        () => sortTracks(likedTracks, sort, i18n.language),
        [likedTracks, sort, i18n.language],
    );

    const filtered = useMemo(() => {
        if (!filter) return ordered;
        const q = filter.toLowerCase();
        return ordered.filter(
            (tr) => tr.title.toLowerCase().includes(q) || tr.user.username.toLowerCase().includes(q),
        );
    }, [ordered, filter]);

    const filteredRef = useRef(filtered);
    filteredRef.current = filtered;
    const getQueue = useCallback(() => filteredRef.current, []);

    const loadAllRef = useRef(loadAll);
    loadAllRef.current = loadAll;
    const onLikePlay = useCallback(() => {
        if (!loadAllRef.current) armLikesContinuation();
    }, []);

    const notice = syncNoticeOf({isError: likesQuery.isError && likedTracks.length === 0, syncState});
    const retry = () => {
        void likesQuery.refetch();
    };

    return (
        <div className="min-h-[400px]">
            <div className="flex flex-col gap-1">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-white/20"/>
                    </div>
                ) : filtered.length > 0 ? (
                    <VirtualList
                        items={filtered}
                        rowHeight={68}
                        overscan={8}
                        className="flex flex-col gap-1"
                        disabled={filtered.length < 40}
                        getItemKey={(track) => track.urn}
                        renderItem={(track, i) => (
                            <LibraryTrackRow track={track} index={i} queue={getQueue} onPlay={onLikePlay}/>
                        )}
                    />
                ) : filter ? (
                    <div className="py-20 text-center text-white/20">
                        {likesQuery.hasNextPage ? t('common.loading') : t('library.noMatches')}
                    </div>
                ) : notice ? (
                    <div className="py-20">
                        <SyncNotice kind={notice} text={t(LIKES_NOTICE_TEXT[notice])} onRetry={retry}/>
                    </div>
                ) : (
                    <div className="py-20 text-center text-white/20">{t('library.noLikedTracks')}</div>
                )}
            </div>
            {!loadAll ? (
                <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
                    {likesQuery.isFetchingNextPage && (
                        <Loader2 size={20} className="text-white/15 animate-spin"/>
                    )}
                </div>
            ) : likesQuery.isFetchingNextPage ? (
                <div className="h-12 flex items-center justify-center mt-4">
                    <Loader2 size={20} className="text-white/15 animate-spin"/>
                </div>
            ) : null}
            {!loadAll && notice && likedTracks.length > 0 && !likesQuery.hasNextPage && (
                <div className="pb-6">
                    <SyncNotice kind={notice} text={t(LIKES_NOTICE_TEXT[notice])} onRetry={retry}/>
                </div>
            )}
        </div>
    );
});
