import { useQuery } from '@tanstack/react-query';
import { isLocalUrn } from '../../../lib/local-library';
import { fetchTracksByUrns } from '../../../lib/soundwave';
import type { Track } from '../../../stores/player';

const GATHER_MS = 40;
const BATCH_MAX = 50;
const LIVE_STALE_MS = 5 * 60_000;
const LIVE_GC_MS = 30 * 60_000;

type Waiter = (track: Track | null) => void;

let waiting = new Map<string, Waiter[]>();
let scheduled = false;

function loadLiveTrack(urn: string): Promise<Track | null> {
  return new Promise((resolve) => {
    waiting.set(urn, [...(waiting.get(urn) ?? []), resolve]);
    if (scheduled) return;
    scheduled = true;
    setTimeout(flush, GATHER_MS);
  });
}

async function flush(): Promise<void> {
  const batch = waiting;
  waiting = new Map();
  scheduled = false;
  const urns = [...batch.keys()];
  for (let start = 0; start < urns.length; start += BATCH_MAX) {
    const part = urns.slice(start, start + BATCH_MAX);
    const tracks = await fetchTracksByUrns(part);
    const byUrn = new Map(tracks.map((track) => [track.urn, track]));
    for (const urn of part) {
      for (const resolve of batch.get(urn) ?? []) resolve(byUrn.get(urn) ?? null);
    }
  }
}

export function useLiveTrack(urn: string, visible: boolean): Track | null {
  const { data } = useQuery({
    queryKey: ['chat', 'embed-track', urn],
    queryFn: () => loadLiveTrack(urn),
    enabled: visible && !!urn && !isLocalUrn(urn),
    staleTime: LIVE_STALE_MS,
    gcTime: LIVE_GC_MS,
    retry: false,
  });
  return data ?? null;
}
