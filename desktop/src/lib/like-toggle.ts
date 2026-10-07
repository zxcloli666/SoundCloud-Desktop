import type { QueryClient } from '@tanstack/react-query';
import type { Track } from '../stores/player';
import { api } from './api';
import { invalidateAllLikesCache } from './hooks';
import { optimisticToggleLike } from './likes';

export async function setTrackLiked(qc: QueryClient, track: Track, liked: boolean) {
  optimisticToggleLike(qc, track, liked);
  invalidateAllLikesCache();
  try {
    await api(`/likes/tracks/${encodeURIComponent(track.urn)}`, {
      method: liked ? 'POST' : 'DELETE',
    });
  } catch {
    optimisticToggleLike(qc, track, !liked);
  }
}
