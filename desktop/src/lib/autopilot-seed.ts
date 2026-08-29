import type { QueueAdvanceReason, Track } from '../stores/player';
import { useRecommendationTasteStore } from '../stores/recommendation-taste';
import type { AutopilotWaveSeed } from './autopilot-wave-session';
import { isUrnDisliked } from './dislikes';
import { isRecommendationTrackPlayable } from './home-recommendations';
import { isUrnLiked } from './likes';

export interface AutopilotContinuationSeed {
  relatedTrack: Track | null;
  wave: AutopilotWaveSeed;
}

function positiveSeed(track: Track): boolean {
  if (isUrnDisliked(track.urn) || !isRecommendationTrackPlayable(track)) return false;
  if (track.user_favorite || isUrnLiked(track.urn)) return true;
  const signal = useRecommendationTasteStore.getState().tracks[track.urn];
  return Boolean(
    signal &&
      (signal.explicitPreference === 'liked' || signal.completes > 0 || signal.behaviorScore > 0),
  );
}

function trackSeed(track: Track): AutopilotContinuationSeed | null {
  const id = track.urn.split(':').pop()?.trim();
  if (!id) return null;
  return { wave: { kind: 'track', id }, relatedTrack: track };
}

/** Never ask for more music resembling a track the listener just skipped or disliked. */
export function chooseAutopilotContinuationSeed(
  lastTrack: Track,
  reason: QueueAdvanceReason,
  queue: readonly Track[],
  queueIndex: number,
): AutopilotContinuationSeed {
  if (reason === 'ended' && !isUrnDisliked(lastTrack.urn)) {
    const seed = trackSeed(lastTrack);
    if (seed) return seed;
  }

  for (let index = queueIndex - 1; index >= 0; index--) {
    const track = queue[index];
    if (!positiveSeed(track)) continue;
    const seed = trackSeed(track);
    if (seed) return seed;
  }

  for (const track of useRecommendationTasteStore.getState().recentTracks) {
    if (track.urn === lastTrack.urn || !positiveSeed(track)) continue;
    const seed = trackSeed(track);
    if (seed) return seed;
  }

  return { wave: { kind: 'user' }, relatedTrack: null };
}
