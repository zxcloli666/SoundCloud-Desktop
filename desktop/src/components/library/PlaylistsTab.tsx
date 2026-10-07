import React, {useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useInfiniteScroll, useMyLikedPlaylists, useMyPlaylists} from '../../lib/hooks';
import {Loader2} from '../../lib/icons';
import {matchesTerms, queryTerms} from '../../lib/text-match';
import {PlaylistCard} from '../music/PlaylistCard';
import {SyncNotice, syncNoticeOf} from '../ui/SyncNotice';
import {VirtualGrid} from '../ui/VirtualGrid';

export const PlaylistsTab = React.memo(function PlaylistsTab({filter}: { filter: string }) {
    const {t} = useTranslation();
    const myPlaylistsQuery = useMyPlaylists();
    const likedPlaylistsQuery = useMyLikedPlaylists();
    const createdPlaylists = myPlaylistsQuery.playlists;
    const likedPlaylists = likedPlaylistsQuery.playlists;

    const filteredCreated = useMemo(() => {
        const terms = queryTerms(filter);
        return terms.length > 0
            ? createdPlaylists.filter((p) => matchesTerms(terms, p.title, p.user.username))
            : createdPlaylists;
    }, [createdPlaylists, filter]);

    const filteredLiked = useMemo(() => {
        const terms = queryTerms(filter);
        return terms.length > 0
            ? likedPlaylists.filter((p) => matchesTerms(terms, p.title, p.user.username))
            : likedPlaylists;
    }, [likedPlaylists, filter]);

    const hasNextPage = likedPlaylistsQuery.hasNextPage || myPlaylistsQuery.hasNextPage;
    const isFetchingNextPage =
        likedPlaylistsQuery.isFetchingNextPage || myPlaylistsQuery.isFetchingNextPage;
    const fetchNextPage = likedPlaylistsQuery.hasNextPage
        ? likedPlaylistsQuery.fetchNextPage
        : myPlaylistsQuery.fetchNextPage;
    const sentinelRef = useInfiniteScroll(!!hasNextPage, !!isFetchingNextPage, fetchNextPage);

    // Auto-fetch remaining pages when filtering
    useEffect(() => {
        if (filter && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [filter, hasNextPage, isFetchingNextPage]);

    const notice = syncNoticeOf(myPlaylistsQuery) ?? syncNoticeOf(likedPlaylistsQuery);
    const retry = () => {
        void myPlaylistsQuery.refetch();
        void likedPlaylistsQuery.refetch();
    };

    return (
        <div className="min-h-[400px]">
            <div className="space-y-10">
                {myPlaylistsQuery.isLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 size={24} className="animate-spin text-white/20"/>
                    </div>
                ) : filteredCreated.length > 0 ? (
                    <section>
                        <h3 className="text-lg font-bold text-white/80 mb-5 px-1">
                            {t('library.yourPlaylists')}
                        </h3>
                        <VirtualGrid
                            items={filteredCreated}
                            itemHeight={320}
                            minColumnWidth={180}
                            gap={24}
                            overscan={3}
                            disabled={filteredCreated.length < 30}
                            getItemKey={(playlist) => playlist.urn}
                            renderItem={(playlist) => <PlaylistCard playlist={playlist}/>}
                        />
                    </section>
                ) : null}

                {likedPlaylistsQuery.isLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 size={24} className="animate-spin text-white/20"/>
                    </div>
                ) : filteredLiked.length > 0 ? (
                    <section>
                        <h3 className="text-lg font-bold text-white/80 mb-5 px-1">
                            {t('library.likedPlaylists')}
                        </h3>
                        <VirtualGrid
                            items={filteredLiked}
                            itemHeight={320}
                            minColumnWidth={180}
                            gap={24}
                            overscan={3}
                            disabled={filteredLiked.length < 30}
                            getItemKey={(playlist) => playlist.urn}
                            renderItem={(playlist) => <PlaylistCard playlist={playlist}/>}
                        />
                    </section>
                ) : null}

                {!myPlaylistsQuery.isLoading &&
                    !likedPlaylistsQuery.isLoading &&
                    filteredCreated.length === 0 &&
                    filteredLiked.length === 0 &&
                    (!filter && notice ? (
                        <div className="py-20">
                            <SyncNotice kind={notice} onRetry={retry}/>
                        </div>
                    ) : (
                        <div className="py-20 text-center text-white/20">
                            {filter ? t('library.noMatches') : t('library.noPlaylists')}
                        </div>
                    ))}
            </div>
            {!filter && (
                <div ref={sentinelRef} className="h-12 flex items-center justify-center mt-4">
                    {isFetchingNextPage && <Loader2 size={20} className="text-white/15 animate-spin"/>}
                </div>
            )}
        </div>
    );
});
