import type { Track } from '../stores/player';
import { usePlayerStore } from '../stores/player';
import { getQueueContinuationSource, setQueueContinuationSource } from './queue-continuation';

const MAX_DUPLICATE_CONTEXT_PAGES = 20;

export type ContextContinuation = 'continued' | 'exhausted' | 'stale';

/** Drain the active likes/playlist source before switching the player to recommendations. */
export async function continueFromQueueContext(
  existingTracks: readonly Track[],
  isCurrent: () => boolean,
): Promise<ContextContinuation> {
  const source = getQueueContinuationSource();
  if (!source) return 'exhausted';

  const existing = new Set<string>();
  for (const track of existingTracks) existing.add(track.urn);
  for (let page = 0; page < MAX_DUPLICATE_CONTEXT_PAGES; page++) {
    let batch: Track[];
    try {
      batch = await source.next();
    } catch (error) {
      if (!isCurrent()) return 'stale';
      console.debug(`[autopilot] source "${source.kind}" failed -> wave:`, error);
      setQueueContinuationSource(null);
      return 'exhausted';
    }
    if (!isCurrent()) return 'stale';
    if (batch.length === 0) {
      console.debug(`[autopilot] source "${source.kind}" exhausted -> wave`);
      setQueueContinuationSource(null);
      return 'exhausted';
    }

    const fresh: Track[] = [];
    for (const track of batch) {
      if (!track?.urn || existing.has(track.urn)) continue;
      existing.add(track.urn);
      fresh.push(track);
    }
    if (fresh.length === 0) continue;

    console.debug(`[autopilot] source "${source.kind}" +${fresh.length} tracks`);
    usePlayerStore.getState().appendToQueueAndPlayNext(fresh);
    return 'continued';
  }

  console.warn(`[autopilot] source "${source.kind}" returned too many duplicate-only pages`);
  setQueueContinuationSource(null);
  return 'exhausted';
}
