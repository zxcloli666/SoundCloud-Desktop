import type { Track } from '../../../api/types.ts';
import { api } from '../../../lib/http';
import { usePlayerStore } from '../../../stores/player';

let autoplayLoading = false;

export async function autoplayRelated(lastTrack: Track) {
  if (autoplayLoading) return;
  autoplayLoading = true;

  try {
    const { queue } = usePlayerStore.getState();
    const existingUrns = new Set(queue.map((t) => t.urn));

    const res = await api<{ collection: Track[] }>(
      `/tracks/${encodeURIComponent(lastTrack.urn)}/related?limit=20`,
    );

    const fresh = res.collection.filter((t) => !existingUrns.has(t.urn));
    if (fresh.length === 0) return;

    usePlayerStore.getState().addToQueue(fresh);
    usePlayerStore.getState().next();
  } catch (error) {
    console.error('Autoplay related failed:', error);
    usePlayerStore.getState().pause();
  } finally {
    autoplayLoading = false;
  }
}
