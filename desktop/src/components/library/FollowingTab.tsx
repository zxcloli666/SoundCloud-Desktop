import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useInfiniteScroll, useMyFollowings} from '../../lib/hooks';
import {Loader2} from '../../lib/icons';
import {VirtualGrid} from '../ui/VirtualGrid';
import {UserCard} from './UserCard';
import {useBoundedFilterPages} from './useBoundedFilterPages';

export const FollowingTab = React.memo(function FollowingTab({filter}: { filter: string }) {
    const {t} = useTranslation();
    const followingsQuery = useMyFollowings();
    const {users: followings, isLoading} = followingsQuery;
    const sentinelRef = useInfiniteScroll(
        !!followingsQuery.hasNextPage,
        !!followingsQuery.isFetchingNextPage,
        followingsQuery.fetchNextPage,
    );

    const filtered = useMemo(() => {
        if (!filter) return followings;
        const q = filter.toLowerCase();
        return followings.filter((u) => u.username.toLowerCase().includes(q));
    }, [followings, filter]);
    const isFilteringMore = useBoundedFilterPages(
        filter,
        filtered.length,
        followingsQuery.hasNextPage,
        isLoading,
        followingsQuery.isFetchingNextPage,
        followingsQuery.fetchNextPage,
    );

    return (
        <div className="min-h-[400px]">
            {isLoading || (isFilteringMore && filtered.length === 0) ? (
                <div className="flex justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-white/20"/>
                </div>
            ) : filtered.length > 0 ? (
                <VirtualGrid
                    items={filtered}
                    itemHeight={220}
                    minColumnWidth={160}
                    gap={16}
                    overscan={3}
                    disabled={filtered.length < 30}
                    getItemKey={(user) => user.urn}
                    renderItem={(user) => <UserCard user={user}/>}
                />
            ) : (
                <div className="py-20 text-center text-white/20">
                    {filter
                        ? t(followingsQuery.hasNextPage ? 'library.noMatchesLoaded' : 'library.noMatches')
                        : t('library.notFollowing')}
                </div>
            )}
            {!filter && (
                <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
                    {followingsQuery.isFetchingNextPage && (
                        <Loader2 size={20} className="text-white/15 animate-spin"/>
                    )}
                </div>
            )}
            {filter && isFilteringMore && filtered.length > 0 && (
                <div className="h-12 flex items-center justify-center mt-4">
                    <Loader2 size={20} className="text-white/15 animate-spin"/>
                </div>
            )}
        </div>
    );
});
