import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { isLocalUrn } from '../../../lib/local-library';
import { type Track, usePlayerStore } from '../../../stores/player';

export function useCurrentTrackData() {
  const urn = usePlayerStore((s) => s.currentTrack?.urn ?? '');
  const local = urn !== '' && isLocalUrn(urn);
  const { data } = useQuery({
    queryKey: ['track', urn],
    queryFn: () => api<Track>(`/tracks/${encodeURIComponent(urn)}`),
    enabled: urn !== '' && !local,
    staleTime: 30_000,
  });
  return { urn, local, usable: urn !== '' && !local, trackData: data };
}
