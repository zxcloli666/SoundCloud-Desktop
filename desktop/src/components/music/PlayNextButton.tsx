import type React from 'react';
import { useTranslation } from 'react-i18next';
import { ListStart } from '../../lib/icons';
import { playTrackNext } from '../../lib/track-actions';
import type { Track } from '../../stores/player';

export function PlayNextButton({
  track,
  className,
  size = 14,
}: {
  track: Track;
  className: string;
  size?: number;
}) {
  const { t } = useTranslation();
  const label = t('trackMenu.playNext');

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playTrackNext(track);
  };

  return (
    <button type="button" onClick={onClick} className={className} title={label} aria-label={label}>
      <ListStart size={size} />
    </button>
  );
}
