import type React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Disc3 } from '../../lib/icons';
import { getAlbumTarget } from '../../lib/track-display';
import type { Track } from '../../stores/player';

interface AlbumLinkButtonProps {
  track: Pick<Track, 'enrichment'>;
  className: string;
  iconSize?: number;
}

export function AlbumLinkButton({ track, className, iconSize = 16 }: AlbumLinkButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const target = getAlbumTarget(track);
  const albumTitle = track.enrichment?.album?.title;
  if (!target || !albumTitle) return null;

  const label = t('track.openAlbum', { title: albumTitle });
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(target);
  };

  return (
    <button type="button" onClick={open} title={label} aria-label={label} className={className}>
      <Disc3 size={iconSize} />
    </button>
  );
}
