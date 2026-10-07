import { toast } from 'sonner';
import i18n from '../i18n';
import { type Track, usePlayerStore } from '../stores/player';
import { api } from './api';
import { isUrnDisliked, toggleDislike } from './dislikes';
import { invalidateAllLikesCache } from './hooks';
import { isUrnLiked, optimisticToggleLike } from './likes';
import { queryClient } from './query-client';
import { getDisplayTitle } from './track-display';

function setLike(track: Track, liked: boolean) {
  optimisticToggleLike(queryClient, track, liked);
  invalidateAllLikesCache();
  api(`/likes/tracks/${encodeURIComponent(track.urn)}`, {
    method: liked ? 'POST' : 'DELETE',
  }).catch(() => optimisticToggleLike(queryClient, track, !liked));
}

export function clearDislike(urn: string) {
  if (isUrnDisliked(urn)) void toggleDislike(queryClient, { urn }, false);
}

export async function dislikeTrack(track: Track, { undo = true }: { undo?: boolean } = {}) {
  const wasLiked = isUrnLiked(track.urn) || !!track.user_favorite;
  if (wasLiked) setLike(track, false);

  const player = usePlayerStore.getState();
  const wasPlayingAt = player.currentTrack?.urn === track.urn ? player.queueIndex : -1;
  if (wasPlayingAt >= 0) player.next();

  await toggleDislike(queryClient, track, true);
  if (!undo || !isUrnDisliked(track.urn)) return;

  toast(i18n.t('dislikes.added'), {
    id: `dislike:${track.urn}`,
    description: getDisplayTitle(track),
    action: {
      label: i18n.t('dislikes.undo'),
      onClick: () => {
        clearDislike(track.urn);
        if (wasLiked) setLike(track, true);
        const { queue, playFromQueue } = usePlayerStore.getState();
        if (queue[wasPlayingAt]?.urn === track.urn) playFromQueue(wasPlayingAt);
      },
    },
  });
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
