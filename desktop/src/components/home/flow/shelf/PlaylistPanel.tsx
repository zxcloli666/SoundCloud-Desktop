import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../lib/api';
import { art } from '../../../../lib/formatters';
import type { Playlist } from '../../../../lib/hooks';
import { Heart } from '../../../../lib/icons';
import { patchLikedCollections } from '../../../../lib/liked-collections';
import { ShelfAction, ShelfCard } from './ShelfCard';
import { ShelfScroll } from './ShelfScroll';

export function PlaylistPanel({ playlists, onEnd }: { playlists: Playlist[]; onEnd?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const unlike = async (playlist: Playlist) => {
    patchLikedCollections(qc, playlist, false);
    try {
      await api(`/likes/playlists/${encodeURIComponent(playlist.urn)}`, { method: 'DELETE' });
      void qc.invalidateQueries({ queryKey: ['likes', 'playlist', playlist.urn] });
    } catch {
      patchLikedCollections(qc, playlist, true);
    }
  };

  return (
    <ShelfScroll
      items={playlists}
      keyOf={(playlist) => playlist.urn}
      onEnd={onEnd}
      renderItem={(playlist) => (
        <ShelfCard
          scrollKey={playlist.urn}
          cover={art(playlist.artwork_url || playlist.user?.avatar_url, 't300x300')}
          title={playlist.title}
          subtitle={playlist.user?.username}
          coverLabel={playlist.title}
          onOpen={() => navigate(`/playlist/${encodeURIComponent(playlist.urn)}`)}
          action={
            <ShelfAction
              label={t('flowRedesign.removeLiked')}
              onClick={() => void unlike(playlist)}
            >
              <Heart size={13} fill="currentColor" aria-hidden />
            </ShelfAction>
          }
        />
      )}
    />
  );
}
