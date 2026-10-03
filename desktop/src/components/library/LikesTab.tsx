import React, {useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useInfiniteScroll, useLikedTracks} from '../../lib/hooks';
import {Loader2} from '../../lib/icons';
import {armLikesContinuation} from '../../lib/queue-continuation';
import {VirtualList} from '../ui/VirtualList';
import {LibraryTrackRow} from './LibraryTrackRow';
import {LikesNotice, type LikesNoticeKind} from './LikesNotice';

export const LikesTab = React.memo(function LikesTab({filter}: { filter: string }) {
    const {t} = useTranslation();
    const likesQuery = useLikedTracks();
    const {tracks: likedTracks, isLoading, syncState} = likesQuery;
    const sentinelRef = useInfiniteScroll(
        !!likesQuery.hasNextPage,
        !!likesQuery.isFetchingNextPage,
        likesQuery.fetchNextPage,
    );

    // Auto-fetch remaining pages when filtering
    useEffect(() => {
        if (filter && likesQuery.hasNextPage && !likesQuery.isFetchingNextPage) {
            likesQuery.fetchNextPage();
        }
    }, [filter, likesQuery.hasNextPage, likesQuery.isFetchingNextPage]);

    const filtered = useMemo(() => {
        if (!filter) return likedTracks;
        const q = filter.toLowerCase();
        return likedTracks.filter(
            (tr) => tr.title.toLowerCase().includes(q) || tr.user.username.toLowerCase().includes(q),
        );
    }, [likedTracks, filter]);

    // Включили трек из лайков → ставим прослойку: она доиграет ВСЕ лайки,
    // подкачивая страницы по мере опустошения очереди, а как кончатся — отдаст
    // управление волне (lib/queue-autopilot.ts). Под активным фильтром очередь
    // уже = весь матч (страницы дотянуты выше), источник не нужен (play() и так
    // сбросил прошлый) → сразу волна. filterRef — чтобы колбэк был стабильным
    // для memo'нутых строк и при этом видел свежий фильтр.
    const filterRef = React.useRef(filter);
    filterRef.current = filter;
    const onLikePlay = React.useCallback(() => {
        if (!filterRef.current) armLikesContinuation();
    }, []);

    const failed = likesQuery.isError && likedTracks.length === 0;
    const notice: LikesNoticeKind | null = failed ? 'failed' : syncState === 'complete' ? null : syncState;
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
                            <LibraryTrackRow track={track} index={i} queue={filtered} onPlay={onLikePlay}/>
                        )}
                    />
                ) : filter ? (
                    <div className="py-20 text-center text-white/20">
                        {likesQuery.hasNextPage ? t('common.loading') : t('library.noMatches')}
                    </div>
                ) : notice ? (
                    <div className="py-20">
                        <LikesNotice kind={notice} onRetry={retry}/>
                    </div>
                ) : (
                    <div className="py-20 text-center text-white/20">{t('library.noLikedTracks')}</div>
                )}
            </div>
            {!filter ? (
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
            {!filter && notice && likedTracks.length > 0 && !likesQuery.hasNextPage && (
                <div className="pb-6">
                    <LikesNotice kind={notice} onRetry={retry}/>
                </div>
            )}
        </div>
    );
});
