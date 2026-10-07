import { memo, useCallback, useMemo } from 'react';
import { albumScope } from '../../lib/bulk-cache';
import { SaveCollectionMenu } from '../collection-save/SaveCollectionMenu';
import type { AlbumDetail } from './types';

function AlbumSaveButtonImpl({ album }: { album: AlbumDetail }) {
  const playable = useMemo(
    () => album.tracks.filter((tr) => tr.enrichment?.availability !== 'wanted'),
    [album.tracks],
  );
  const collect = useCallback(async () => playable, [playable]);

  if (playable.length === 0) return null;

  return (
    <SaveCollectionMenu
      scope={albumScope(album.id)}
      title={album.title}
      tracks={playable}
      trackCount={playable.length}
      collect={collect}
      variant="pill"
    />
  );
}

export const AlbumSaveButton = memo(AlbumSaveButtonImpl);
