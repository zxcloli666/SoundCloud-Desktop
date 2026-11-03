import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuthStore } from '../stores/auth';
import type { Track } from '../stores/player';
import { api } from './api';
import { withoutHidden } from './feed-filter';
import { scDateMs } from './formatters';
import type { PagedResponse } from './hooks';
import { RELEASE_DAYS, type Release, recentOriginals } from './new-releases';
import { usePremium } from './premium-cache';

const PAGE_SIZE = 50;
const DAY_MS = 86_400_000;
export const RELEASES_CHECK_MS = 30 * 60_000;
export const RELEASES_KEY = ['me', 'new-releases'] as const;
const HEARD_KEY = ['me', 'new-releases', 'heard'] as const;

function uploadedAt(track: Track): number {
  return scDateMs(track.created_at || track.release_date);
}

function fetchPage(page: number) {
  return api<PagedResponse<Track>>(`/me/followings/tracks?limit=${PAGE_SIZE}&page=${page}`);
}

function reachesPastWindow(page: PagedResponse<Track>, now: number): boolean {
  const last = page.collection[page.collection.length - 1];
  return !last || uploadedAt(last) < now - RELEASE_DAYS * DAY_MS;
}

export async function fetchReleases(now = Date.now()): Promise<Release[]> {
  const first = await fetchPage(0);
  const tracks = [...first.collection];
  if (first.has_more && !reachesPastWindow(first, now)) {
    tracks.push(...(await fetchPage(1)).collection);
  }
  const releases = withoutHidden(tracks).map((track) => ({ track, at: uploadedAt(track) }));
  return recentOriginals(releases, now);
}

export function useNewReleases(enabled: boolean) {
  return useQuery({
    queryKey: RELEASES_KEY,
    queryFn: () => fetchReleases(),
    staleTime: RELEASES_CHECK_MS,
    enabled,
    select: (releases) => releases.map((release) => release.track),
  });
}

export function useHeardUrns(enabled: boolean): ReadonlySet<string> {
  const { data } = useQuery({
    queryKey: HEARD_KEY,
    queryFn: async () => {
      const page = await api<{ collection: Array<{ trackUrn: string | null }> }>(
        '/history?limit=200&offset=0',
      );
      return page.collection.flatMap((entry) => (entry.trackUrn ? [entry.trackUrn] : []));
    },
    staleTime: 5 * 60_000,
    enabled,
  });
  return useMemo(() => new Set(data), [data]);
}

export function useReleaseFeed(starOnly = true) {
  const premium = usePremium();
  const signedIn = useAuthStore((s) => !!s.user);
  const enabled = signedIn && (premium || !starOnly);
  const releases = useNewReleases(enabled);
  const heard = useHeardUrns(enabled);
  const tracks = releases.data ?? NO_TRACKS;
  const unheard = useMemo(() => tracks.filter((t) => !heard.has(t.urn)).length, [tracks, heard]);
  return { enabled, tracks, heard, unheard, query: releases };
}

const NO_TRACKS: Track[] = [];
