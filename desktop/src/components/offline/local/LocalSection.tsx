import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { forgetLocalTracks } from '../../../lib/local-import';
import { useLocalLibrary } from '../../../stores/local-library';
import { usePlayerStore } from '../../../stores/player';
import type { SortMode } from '../types';
import { LocalImportPanel } from './LocalImportPanel';
import { LocalPlaylistHeader } from './LocalPlaylistHeader';
import { LocalPlaylistStrip } from './LocalPlaylistStrip';
import { LocalTrackList } from './LocalTrackList';
import type { LocalRow } from './lib';
import type { LocalView } from './useLocalView';

export const LocalSection = React.memo(function LocalSection({
  view,
  query,
  sort,
}: {
  view: LocalView;
  query: string;
  sort: SortMode;
}) {
  const { t } = useTranslation();
  const { playlist, playable, openPlaylist } = view;

  const handlePlay = useCallback(
    (row: LocalRow) => void usePlayerStore.getState().play(row.track, playable),
    [playable],
  );

  const handleRemove = useCallback(
    (row: LocalRow) => {
      if (playlist) useLocalLibrary.getState().removeFromPlaylist(playlist.id, [row.id]);
      else forgetLocalTracks([row.id]);
    },
    [playlist],
  );

  const handleReorder = useCallback(
    (ids: string[]) => {
      const store = useLocalLibrary.getState();
      if (playlist) store.reorderPlaylist(playlist.id, ids);
      else store.reorder(ids);
    },
    [playlist],
  );

  const emptyText = query.trim()
    ? t('offline.searchEmpty')
    : playlist
      ? t('local.playlistEmpty')
      : t('local.empty');

  return (
    <>
      {playlist ? (
        <LocalPlaylistHeader playlist={playlist} onBack={() => openPlaylist(null)} />
      ) : (
        <>
          <LocalImportPanel count={view.count} totalBytes={view.totalBytes} />
          {view.count > 0 && (
            <LocalPlaylistStrip playlists={view.playlists} onOpen={openPlaylist} />
          )}
        </>
      )}
      <LocalTrackList
        rows={view.rows}
        sortable={sort === 'custom' && query.trim() === ''}
        inPlaylist={playlist !== null}
        emptyText={emptyText}
        onPlay={handlePlay}
        onRemove={handleRemove}
        onReorder={handleReorder}
      />
    </>
  );
});
