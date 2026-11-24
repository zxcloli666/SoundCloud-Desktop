import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ListPlus } from '../../lib/icons';
import { useAddToPlaylistRequest } from '../../stores/add-to-playlist';
import type { Track } from '../../stores/player';

export const AddToPlaylistButton = memo(function AddToPlaylistButton({
  track,
  size = 14,
  className,
}: {
  track: Track;
  size?: number;
  className: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        useAddToPlaylistRequest.getState().request(track);
      }}
      className={className}
      title={t('playlist.addToPlaylist')}
      aria-label={t('playlist.addToPlaylist')}
    >
      <ListPlus size={size} />
    </button>
  );
});
