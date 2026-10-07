import type { QueryClient } from '@tanstack/react-query';
import type { Track } from '../stores/player';
import { api } from './api';
import { forgetOfflineLike } from './cache';
import { invalidateAllLikesCache } from './hooks';
import { optimisticToggleLike } from './likes';
import { rememberLikedUrn } from './offline-index';

export async function setTrackLiked(qc: QueryClient, track: Track, liked: boolean) {
  optimisticToggleLike(qc, track, liked);
  invalidateAllLikesCache();
  try {
    await api(`/likes/tracks/${encodeURIComponent(track.urn)}`, {
      method: liked ? 'POST' : 'DELETE',
    });
    void (liked ? rememberLikedUrn(track.urn, track) : forgetOfflineLike(track.urn));
  } catch {
    optimisticToggleLike(qc, track, !liked);
  }
}
