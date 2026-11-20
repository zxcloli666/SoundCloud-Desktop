import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { usePlaylistCoverStore } from '../../../stores/playlist-cover';

const FIRST_LOOK_MS = 4_000;
const LAST_LOOK_MS = 60_000;

export function useCoverSync(playlistUrn: string, artworkUrl: string | null) {
  const qc = useQueryClient();
  const change = usePlaylistCoverStore((s) => s.changes[playlistUrn]);
  const syncing = change?.phase === 'syncing';
  const arrived = syncing && !!artworkUrl && artworkUrl !== change.before;
  const [look, setLook] = useState(0);

  useEffect(() => {
    if (!arrived) return;
    usePlaylistCoverStore.getState().drop(playlistUrn);
    qc.invalidateQueries({ queryKey: ['me', 'playlists'] });
    qc.invalidateQueries({ queryKey: ['user'] });
  }, [arrived, playlistUrn, qc]);

  useEffect(() => {
    if (!syncing || arrived) {
      setLook(0);
      return;
    }
    const wait = Math.min(LAST_LOOK_MS, FIRST_LOOK_MS * 1.5 ** look);
    const timer = setTimeout(() => {
      qc.invalidateQueries({ queryKey: ['playlist', playlistUrn], exact: true });
      setLook((n) => n + 1);
    }, wait);
    return () => clearTimeout(timer);
  }, [syncing, arrived, look, playlistUrn, qc]);

  return change;
}
