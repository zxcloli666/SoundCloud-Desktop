import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { retryWhileRefreshing } from '../../../lib/hooks';

export type StatsPeriod = 'week' | 'month' | 'year' | 'all';
export const STATS_PERIODS: StatsPeriod[] = ['week', 'month', 'year', 'all'];
export const STATS_QUERY_KEY = 'history-stats';

export interface StatsTotals {
  plays: number;
  listenedMs: number;
  tracks: number;
  artists: number;
}

export interface TopTrack {
  trackUrn: string;
  title: string;
  artistName: string;
  artistUrn: string | null;
  artworkUrl: string | null;
  duration: number;
  plays: number;
  listenedMs: number;
}

export interface TopArtist {
  artistName: string;
  artistUrn: string | null;
  artworkUrl: string | null;
  plays: number;
  tracks: number;
  listenedMs: number;
}

export interface TimelinePoint {
  date: string;
  plays: number;
  listenedMs: number;
}

export interface RhythmCell {
  weekday: number;
  hour: number;
  plays: number;
}

export interface ListeningStats {
  period: StatsPeriod;
  unit: 'day' | 'month';
  from: string;
  to: string;
  totals: StatsTotals;
  previous: StatsTotals | null;
  topTracks: TopTrack[];
  topArtists: TopArtist[];
  timeline: TimelinePoint[];
  rhythm: RhythmCell[];
}

export function useListeningStats(period: StatsPeriod) {
  const utcOffset = -new Date().getTimezoneOffset();
  return useQuery({
    queryKey: [STATS_QUERY_KEY, period, utcOffset],
    queryFn: () => api<ListeningStats>(`/history/stats?period=${period}&utcOffset=${utcOffset}`),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
    ...retryWhileRefreshing,
  });
}
