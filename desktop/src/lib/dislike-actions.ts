import { toast } from 'sonner';
import i18n from '../i18n';
import type { Track } from '../stores/player';
import { isUrnDisliked, toggleDislike } from './dislikes';
import { queryClient } from './query-client';
import { getDisplayTitle } from './track-display';

export function clearDislike(urn: string) {
  if (isUrnDisliked(urn)) void toggleDislike(queryClient, { urn }, false);
}

export function offerUndislike(track: Track) {
  toast(i18n.t('dislikes.playingDisliked'), {
    id: `undislike:${track.urn}`,
    description: getDisplayTitle(track),
    duration: 8000,
    action: {
      label: i18n.t('track.removeDislike'),
      onClick: () => clearDislike(track.urn),
    },
  });
}
