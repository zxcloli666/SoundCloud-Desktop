import React, {useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useInfiniteScroll, useMyFollowings} from '../../lib/hooks';
import {Loader2} from '../../lib/icons';
import {matchesTerms, queryTerms} from '../../lib/text-match';
import {SyncNotice, syncNoticeOf} from '../ui/SyncNotice';
import {VirtualGrid} from '../ui/VirtualGrid';
import {UserCard} from './UserCard';

export const FollowingTab = React.memo(function FollowingTab({filter}: { filter: string }) {
    const {t} = useTranslation();
    const followingsQuery = useMyFollowings();
    const {users: followings, isLoading} = followingsQuery;
    const sentinelRef = useInfiniteScroll(
        !!followingsQuery.hasNextPage,
        !!followingsQuery.isFetchingNextPage,
        followingsQuery.fetchNextPage,
    );

    // Auto-fetch remaining pages when filtering
    useEffect(() => {
        if (filter && followingsQuery.hasNextPage && !followingsQuery.isFetchingNextPage) {
            followingsQuery.fetchNextPage();
        }
    }, [filter, followingsQuery.hasNextPage, followingsQuery.isFetchingNextPage]);

    const filtered = useMemo(() => {
        const terms = queryTerms(filter);
        return terms.length > 0
            ? followings.filter((u) => matchesTerms(terms, u.username))
            : followings;
    }, [followings, filter]);

    const notice = syncNoticeOf(followingsQuery);

    return (
        <div className="min-h-[400px]">
            {isLoading ? (
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
            ) : !filter && notice ? (
                <div className="py-20">
                    <SyncNotice kind={notice} onRetry={() => void followingsQuery.refetch()}/>
                </div>
            ) : (
                <div className="py-20 text-center text-white/20">
                    {filter ? t('library.noMatches') : t('library.notFollowing')}
                </div>
            )}
            {!filter && (
                <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
                    {followingsQuery.isFetchingNextPage && (
                        <Loader2 size={20} className="text-white/15 animate-spin"/>
                    )}
                </div>
            )}
        </div>
    );
});
