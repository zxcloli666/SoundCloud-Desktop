import {
  curateHomeRecommendations,
  type HomeRecommendationInput,
  type HomeRecommendationMode,
  recommendationTrackFromInput,
} from './home-recommendations';
import { isUrnDisliked } from './dislikes';
import { useRecommendationTasteStore } from '../stores/recommendation-taste';
import { useSettingsStore } from '../stores/settings';

/**
 * Imperative local rerank for queue refill and seed-specific recommendation
 * surfaces. Callers decide when to take a new snapshot, so a play event can
 * update taste immediately without rearranging the feed currently under the
 * pointer.
 */
export function curateWithLocalTaste(
  inputs: readonly HomeRecommendationInput[],
  options: {
    hideListened?: boolean;
    limit?: number;
    mode?: HomeRecommendationMode;
  } = {},
) {
  const taste = useRecommendationTasteStore.getState();
  const canUseTaste = taste.ownerReady && Boolean(taste.ownerUrn);
  const recentTracks = canUseTaste ? taste.recentTracks : [];
  const recentUrns = new Set(recentTracks.map((track) => track.urn));
  const blockedUrns = new Set<string>();
  for (const input of inputs) {
    const urn = recommendationTrackFromInput(input).urn;
    if (isUrnDisliked(urn)) blockedUrns.add(urn);
  }
  if (options.hideListened) {
    for (const urn of recentUrns) blockedUrns.add(urn);
  }

  return curateHomeRecommendations(inputs, {
    excludedUrns: options.hideListened ? undefined : recentUrns,
    blockedUrns,
    recentTracks,
    feedback: canUseTaste ? { tracks: taste.tracks, clusters: taste.clusters } : undefined,
    mode: options.mode ?? useSettingsStore.getState().soundwaveMode,
    limit: options.limit ?? inputs.length,
  });
}
