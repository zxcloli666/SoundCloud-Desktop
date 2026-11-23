import { useMemo } from 'react';
import { type QueueOrigin, usePlayerStore } from '../../../stores/player';
import { buildQueueItems, type QueueGroup, queueIds } from './queue-items';

export function groupOf(origin: QueueOrigin | undefined): QueueGroup {
  return origin ?? 'context';
}

export function useQueueShape(playedOpen: boolean) {
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const origins = usePlayerStore((s) => s.queueOrigins);
  const hasTrack = usePlayerStore((s) => s.currentTrack !== null);

  const ids = useMemo(() => queueIds(queue.map((track) => track.urn)), [queue]);
  const groups = useMemo(() => queue.map((track) => groupOf(origins[track.urn])), [queue, origins]);
  const items = useMemo(
    () => buildQueueItems({ ids, groups, queueIndex, playedOpen, autoplayFooter: hasTrack }),
    [ids, groups, queueIndex, playedOpen, hasTrack],
  );

  return { queue, queueIndex, ids, groups, items };
}
