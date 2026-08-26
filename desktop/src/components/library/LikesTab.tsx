import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useInfiniteScroll, useLikedTracks} from '../../lib/hooks';
import {Loader2} from '../../lib/icons';
import {armLikesContinuation} from '../../lib/queue-continuation';
import {VirtualList} from '../ui/VirtualList';
import {LibraryTrackRow} from './LibraryTrackRow';
import {useBoundedFilterPages} from './useBoundedFilterPages';

export const LikesTab = React.memo(function LikesTab({filter}: { filter: string }) {
    const {t} = useTranslation();
    const likesQuery = useLikedTracks();
    const {tracks: likedTracks, isLoading} = likesQuery;
    const sentinelRef = useInfiniteScroll(
        !!likesQuery.hasNextPage,
        !!likesQuery.isFetchingNextPage,
        likesQuery.fetchNextPage,
    );

    const filtered = useMemo(() => {
        if (!filter) return likedTracks;
        const q = filter.toLowerCase();
        return likedTracks.filter(
            (tr) => tr.title.toLowerCase().includes(q) || tr.user.username.toLowerCase().includes(q),
        );
    }, [likedTracks, filter]);
    const isFilteringMore = useBoundedFilterPages(
        filter,
        filtered.length,
        likesQuery.hasNextPage,
        isLoading,
        likesQuery.isFetchingNextPage,
        likesQuery.fetchNextPage,
    );

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

    return (
        <div className="min-h-[400px]">
            <div className="flex flex-col gap-1">
                {isLoading || (isFilteringMore && filtered.length === 0) ? (
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
                ) : (
                    <div className="py-20 text-center text-white/20">
                    {filter
                        ? t(likesQuery.hasNextPage ? 'library.noMatchesLoaded' : 'library.noMatches')
                        : t('library.noLikedTracks')}
                    </div>
                )}
            </div>
            {!filter ? (
                <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
                    {likesQuery.isFetchingNextPage && (
                        <Loader2 size={20} className="text-white/15 animate-spin"/>
                    )}
                </div>
            ) : isFilteringMore && filtered.length > 0 ? (
                <div className="h-12 flex items-center justify-center mt-4">
                    <Loader2 size={20} className="text-white/15 animate-spin"/>
                </div>
            ) : null}
        </div>
    );
});
