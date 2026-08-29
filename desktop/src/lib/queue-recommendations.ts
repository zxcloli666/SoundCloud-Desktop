import type { Track } from '../stores/player';
import { isUrnDisliked } from './dislikes';
import { type HomeRecommendationMode, isRecommendationTrackPlayable } from './home-recommendations';
import { isUrnLiked } from './likes';
import { curateWithLocalTaste } from './local-recommendations';

export interface QueueRecommendationOptions {
  hideLiked: boolean;
  hideListened: boolean;
  limit: number;
  mode: HomeRecommendationMode;
}

function recordingKey(track: Track): string | null {
  const isrc = track.publisher_metadata?.isrc?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return isrc && isrc.length >= 8 ? `isrc:${isrc}` : null;
}

export interface QueueRecommendationContext {
  blockedUrns: ReadonlySet<string>;
  recordingKeys: ReadonlySet<string>;
}

/** Pre-index a queue once when both SmartWave and related fallback may be curated. */
export function createQueueRecommendationContext(
  existingTracks: readonly Track[],
): QueueRecommendationContext {
  const blockedUrns = new Set<string>();
  const recordingKeys = new Set<string>();
  for (const track of existingTracks) {
    if (track.urn) blockedUrns.add(track.urn);
    const key = recordingKey(track);
    if (key) recordingKeys.add(key);
  }
  return { blockedUrns, recordingKeys };
}

/**
 * Apply the same local policy to every queue refill, regardless of whether the
 * candidates came from SmartWave or SoundCloud related tracks.
 *
 * Queue URNs are hard exclusions. ISRC additionally prevents two uploads of
 * the same recording from appearing as consecutive "different" suggestions.
 */
export function curateQueueRecommendations(
  candidates: readonly Track[],
  existingTracks: readonly Track[],
  options: QueueRecommendationOptions,
  context = createQueueRecommendationContext(existingTracks),
): Track[] {
  const candidateRecordings = new Set<string>();
  const eligible: Track[] = [];

  for (const track of candidates) {
    if (
      !track?.urn ||
      context.blockedUrns.has(track.urn) ||
      isUrnDisliked(track.urn) ||
      !isRecommendationTrackPlayable(track) ||
      (options.hideLiked && (track.user_favorite || isUrnLiked(track.urn)))
    ) {
      continue;
    }

    const key = recordingKey(track);
    if (key && (context.recordingKeys.has(key) || candidateRecordings.has(key))) continue;
    if (key) candidateRecordings.add(key);
    eligible.push(track);
  }

  return curateWithLocalTaste(eligible, {
    blockedUrns: context.blockedUrns,
    hideLiked: options.hideLiked,
    hideListened: options.hideListened,
    limit: options.limit,
    mode: options.mode,
  });
}
