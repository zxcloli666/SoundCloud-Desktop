import { useEffect, useMemo, useState } from 'react';
import { refreshLocalMissing } from '../../../lib/local-import';
import { useLocalLibrary } from '../../../stores/local-library';
import type { SortMode } from '../types';
import { buildLocalRows, filterLocalRows, type LocalRow, sortLocalRows } from './lib';

export function useLocalView(query: string, sort: SortMode, active: boolean) {
  const tracks = useLocalLibrary((s) => s.tracks);
  const order = useLocalLibrary((s) => s.order);
  const playlists = useLocalLibrary((s) => s.playlists);
  const missing = useLocalLibrary((s) => s.missing);
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const playlist = playlists.find((p) => p.id === playlistId) ?? null;

  useEffect(() => {
    if (active) void refreshLocalMissing().catch(() => {});
  }, [active]);

  const baseRows = useMemo(
    () => buildLocalRows(playlist ? playlist.trackIds : order, tracks, missing),
    [playlist, order, tracks, missing],
  );

  const rows: LocalRow[] = useMemo(
    () => sortLocalRows(filterLocalRows(baseRows, query), sort),
    [baseRows, query, sort],
  );

  const playable = useMemo(() => rows.filter((r) => !r.missing).map((r) => r.track), [rows]);

  const totalBytes = useMemo(
    () => order.reduce((sum, id) => sum + (tracks[id]?.bytes ?? 0), 0),
    [order, tracks],
  );

  return {
    rows,
    playable,
    playlist,
    playlists,
    openPlaylist: setPlaylistId,
    count: order.length,
    totalBytes,
  };
}

export type LocalView = ReturnType<typeof useLocalView>;
