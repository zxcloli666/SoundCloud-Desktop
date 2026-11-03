import { useMemo } from 'react';
import { useNewReleases, useHeardUrns } from '../../lib/new-releases-api';
import { useAuthStore } from '../../stores/auth';
import type { Track } from '../../stores/player';

export interface FollowingDrops {
  tracks: Track[];
  heard: ReadonlySet<string>;
  unheard: number;
  isLoading: boolean;
  isFetching: boolean;
  hasFollowings: boolean;
  refetch: () => void;
}

export function useFollowingDrops(): FollowingDrops {
  const user = useAuthStore((s) => s.user);
  const releases = useNewReleases(!!user);
  const heard = useHeardUrns(!!user);
  const tracks = useMemo(() => releases.data ?? [], [releases.data]);
  const unheard = useMemo(() => tracks.filter((t) => !heard.has(t.urn)).length, [tracks, heard]);

  return {
    tracks,
    heard,
    unheard,
    isLoading: releases.isLoading,
    isFetching: releases.isFetching,
    hasFollowings: (user?.followings_count ?? 0) > 0,
    refetch: () => void releases.refetch(),
  };
}
