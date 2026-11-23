import type { ClusterQuery } from './useClusterWave';

export interface HomeWaveTaste {
  languages: readonly string[];
  genres: readonly string[];
  hideListened: boolean;
}

export function homeWaveQuery({ languages, genres, hideListened }: HomeWaveTaste): ClusterQuery {
  const langs = [...languages].sort().join(',');
  const tags = [...genres].sort().join(',');
  const qs = new URLSearchParams();
  if (langs) qs.set('languages', langs);
  if (tags) qs.set('genres', tags);
  qs.set('hide_listened', hideListened ? '1' : '0');
  return {
    queryKey: ['cluster-wave', 'home', langs || 'all', tags || 'any', hideListened],
    url: `/recommendations?${qs}`,
  };
}
