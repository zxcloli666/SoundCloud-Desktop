import { useQuery } from '@tanstack/react-query';
import type { Track } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import { hasMoment } from '../moment';
import { queryClient } from '../query-client';
import { fetchSmartWave } from '../soundwave';

export interface MomentsBatch {
  tracks: Track[];
  cursor: string;
}

const TEASER_LIMIT = 8;
const TEASER_STALE_MS = 1000 * 60 * 10;

export async function fetchMoments(opts: {
  cursor?: string;
  limit: number;
  languages: string[];
  hideListened: boolean;
}): Promise<MomentsBatch> {
  const batch = await fetchSmartWave({ seedKind: 'user', mode: 'moments', ...opts });
  return { tracks: batch.tracks.filter(hasMoment), cursor: batch.cursor };
}

function teaserKey(languages: string[], hideListened: boolean) {
  return ['moments', 'teaser', [...languages].sort().join(',') || 'all', hideListened];
}

export function useMomentsTeaser(enabled: boolean): Track[] {
  const languages = useSettingsStore((s) => s.soundwaveLanguages);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const { data } = useQuery({
    queryKey: teaserKey(languages, hideListened),
    enabled,
    staleTime: TEASER_STALE_MS,
    queryFn: () => fetchMoments({ limit: TEASER_LIMIT, languages, hideListened }),
  });
  return data?.tracks ?? EMPTY;
}

export function takeTeaser(languages: string[], hideListened: boolean): MomentsBatch | null {
  const key = teaserKey(languages, hideListened);
  const batch = queryClient.getQueryData<MomentsBatch>(key);
  if (!batch?.tracks.length) return null;
  queryClient.removeQueries({ queryKey: key, exact: true });
  return batch;
}

const EMPTY: Track[] = [];
