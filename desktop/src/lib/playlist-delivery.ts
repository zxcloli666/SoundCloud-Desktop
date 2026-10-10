import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from './api';
import { type PlaylistSync, pagedUrl } from './hooks';

export type PlaylistDelivery = 'sending' | 'blocked';

const PROBE_MS = 15_000;
const PROBE_BUDGET_MS = 10 * 60_000;

export function deliveryOf(sync: PlaylistSync | undefined): PlaylistDelivery | null {
  if (!sync || (sync.pendingOperations ?? 0) === 0) return null;
  return sync.status === 'auth_required' ? 'blocked' : 'sending';
}

export function usePlaylistDelivery(
  playlistUrn: string | undefined,
  sync: PlaylistSync | undefined,
): PlaylistDelivery | null {
  const qc = useQueryClient();
  const delivery = deliveryOf(sync);
  const pending = sync?.pendingOperations ?? 0;

  useEffect(() => {
    if (!playlistUrn || delivery !== 'sending') return;
    const deadline = Date.now() + PROBE_BUDGET_MS;
    const probeUrl = pagedUrl(`/playlists/${encodeURIComponent(playlistUrn)}/tracks`, 0, 1);
    const timer = setInterval(async () => {
      if (Date.now() > deadline) return clearInterval(timer);
      const latest = await api<{ sync?: PlaylistSync }>(probeUrl).catch(() => null);
      if (!latest?.sync || latest.sync.pendingOperations === pending) return;
      clearInterval(timer);
      void qc.invalidateQueries({ queryKey: ['playlist', playlistUrn, 'tracks'], exact: true });
    }, PROBE_MS);
    return () => clearInterval(timer);
  }, [playlistUrn, delivery, pending, qc]);

  return delivery;
}
