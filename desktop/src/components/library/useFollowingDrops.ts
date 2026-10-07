import {useQueries, useQueryClient} from '@tanstack/react-query';
import {useCallback, useMemo} from 'react';
import {api} from '../../lib/api';
import {useFeedFilter} from '../../lib/feed-filter';
import {scDateMs} from '../../lib/formatters';
import {type PagedResponse, useMyFollowings} from '../../lib/hooks';
import type {Track} from '../../stores/player';

const MAX_ARTISTS = 24;
const PER_ARTIST = 6;
const FEED_SIZE = 24;
const STALE_MS = 5 * 60_000;
// Keep the fanned-out track sets cached well past stale so revisiting the hub
// doesn't re-fire 24 requests (each can trigger a cold SC re-sync on the backend).
const GC_MS = 30 * 60_000;

export interface FollowingDrops {
    /** Newest uploads across the people you follow, deduped, newest first. */
    tracks: Track[];
    isLoading: boolean;
    isFetching: boolean;
    hasFollowings: boolean;
    refetch: () => void;
}

/** SC's own `/me/followings/tracks` aggregate returns empty for us, so we build
 *  the feed ourselves: take the people you follow and merge their recent uploads
 *  (the same TTL-refreshed source artist pages use), newest first. */
export function useFollowingDrops(): FollowingDrops {
    const qc = useQueryClient();
    const {users, isLoading: followingsLoading} = useMyFollowings();
    const targets = useMemo(() => users.slice(0, MAX_ARTISTS), [users]);
    const keep = useFeedFilter();

    const combined = useQueries({
        queries: targets.map((u) => ({
            queryKey: ['following-recent', u.urn, PER_ARTIST] as const,
            queryFn: () =>
                api<PagedResponse<Track>>(
                    `/users/${encodeURIComponent(u.urn)}/tracks?limit=${PER_ARTIST}&page=0`,
                ),
            staleTime: STALE_MS,
            gcTime: GC_MS,
        })),
        combine: (results) => {
            const seen = new Set<string>();
            const merged: Track[] = [];
            for (const r of results) {
                for (const t of r.data?.collection ?? []) {
                    if (seen.has(t.urn) || !keep(t)) continue;
                    seen.add(t.urn);
                    merged.push(t);
                }
            }
            merged.sort(
                (a, b) =>
                    scDateMs(b.created_at || b.release_date) - scDateMs(a.created_at || a.release_date),
            );
            return {
                tracks: merged.slice(0, FEED_SIZE),
                isLoading: results.length > 0 && results.some((r) => r.isLoading),
                isFetching: results.some((r) => r.isFetching),
            };
        },
    });

    const refetch = useCallback(() => {
        qc.invalidateQueries({queryKey: ['following-recent']});
    }, [qc]);

    return {
        tracks: combined.tracks,
        isLoading: followingsLoading || combined.isLoading,
        isFetching: combined.isFetching,
        hasFollowings: users.length > 0,
        refetch,
    };
}
