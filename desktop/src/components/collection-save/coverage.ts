import { useCallback, useState } from 'react';
import { getCacheInventory } from '../../lib/cache';
import { isHqStreaming } from '../../lib/streaming';
import type { Track } from '../../stores/player';

const SQ_KBPS = 160;
const HQ_KBPS = 256;
const FALLBACK_TRACK_MS = 210_000;

export function estimateBytes(tracks: Track[], trackCount: number): number {
  const known = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  const avg = tracks.length > 0 ? known / tracks.length : FALLBACK_TRACK_MS;
  const totalMs = known + avg * Math.max(0, trackCount - tracks.length);
  const kbps = isHqStreaming() ? HQ_KBPS : SQ_KBPS;
  return (totalMs / 1000) * ((kbps * 1000) / 8);
}

export function useSavedCoverage(tracks: Track[]) {
  const [saved, setSaved] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const inventory = await getCacheInventory();
      const pinned = new Set(inventory.filter((e) => e.liked).map((e) => e.urn));
      setSaved(tracks.reduce((n, track) => n + (pinned.has(track.urn) ? 1 : 0), 0));
    } catch {
      setSaved(null);
    }
  }, [tracks]);

  return { saved, refresh };
}
