import { useRecommendationTasteStore } from '../stores/recommendation-taste';
import { useSettingsStore } from '../stores/settings';
import { isUrnDisliked } from './dislikes';
import {
  curateHomeRecommendations,
  type HomeRecommendationInput,
  type HomeRecommendationMode,
  recommendationTrackFromInput,
} from './home-recommendations';
import { isUrnLiked } from './likes';

/**
 * Imperative local rerank for queue refill and seed-specific recommendation
 * surfaces. Callers decide when to take a new snapshot, so a play event can
 * update taste immediately without rearranging the feed currently under the
 * pointer.
 */
export function curateWithLocalTaste(
  inputs: readonly HomeRecommendationInput[],
  options: {
    blockedUrns?: ReadonlySet<string>;
    excludedUrns?: ReadonlySet<string>;
    hideLiked?: boolean;
    hideListened?: boolean;
    limit?: number;
    mode?: HomeRecommendationMode;
  } = {},
) {
  const taste = useRecommendationTasteStore.getState();
  const canUseTaste = taste.ownerReady && Boolean(taste.ownerUrn);
  const recentTracks = canUseTaste ? taste.recentTracks : [];
  const recentUrns = new Set(recentTracks.map((track) => track.urn));
  const blockedUrns = new Set(options.blockedUrns);
  const excludedUrns = new Set(options.excludedUrns);
  for (const input of inputs) {
    const track = recommendationTrackFromInput(input);
    if (isUrnDisliked(track.urn)) blockedUrns.add(track.urn);
    if (options.hideLiked && (track.user_favorite || isUrnLiked(track.urn))) {
      blockedUrns.add(track.urn);
    }
  }
  if (options.hideListened) {
    for (const urn of recentUrns) blockedUrns.add(urn);
  } else {
    for (const urn of recentUrns) excludedUrns.add(urn);
  }

  return curateHomeRecommendations(inputs, {
    excludedUrns,
    blockedUrns,
    recentTracks,
    feedback: canUseTaste ? { tracks: taste.tracks, clusters: taste.clusters } : undefined,
    mode: options.mode ?? useSettingsStore.getState().soundwaveMode,
    limit: options.limit ?? inputs.length,
  });
}
