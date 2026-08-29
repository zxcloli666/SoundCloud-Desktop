import { type Track, usePlayerStore } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import type { AutopilotContinuationSeed } from './autopilot-seed';
import { fetchAutopilotWave } from './autopilot-wave-session';
import {
  createQueueRecommendationContext,
  curateQueueRecommendations,
} from './queue-recommendations';
import { fetchRelatedTracks } from './related';

const CANDIDATE_POOL_SIZE = 40;
const CONTINUATION_SIZE = 20;

export interface RecommendationContinuation {
  source: 'wave' | 'related';
  tracks: Track[];
}

export async function fetchQueueRecommendationContinuation(
  seed: AutopilotContinuationSeed,
  options: { signal: AbortSignal; isCurrent: () => boolean },
): Promise<RecommendationContinuation | null> {
  const settings = useSettingsStore.getState();
  const preferences = {
    hideLiked: settings.soundwaveHideLiked,
    hideListened: settings.soundwaveHideListened,
    limit: CONTINUATION_SIZE,
    mode: settings.soundwaveMode,
  };
  let waveCandidates: Track[] = [];

  try {
    waveCandidates = await fetchAutopilotWave(seed.wave, {
      hideListened: preferences.hideListened,
      languages: [...settings.soundwaveLanguages].sort(),
      limit: CANDIDATE_POOL_SIZE,
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal.aborted) throw error;
    console.debug('[autopilot] wave fetch failed:', error);
  }
  if (!options.isCurrent()) return null;

  const existingQueue = usePlayerStore.getState().queue;
  const context = createQueueRecommendationContext(existingQueue);
  const wave = curateQueueRecommendations(waveCandidates, existingQueue, preferences, context);
  if (wave.length > 0) return { source: 'wave', tracks: wave };

  if (!seed.relatedTrack) {
    console.debug('[autopilot] user wave had no eligible tracks and no safe related seed');
    return null;
  }

  console.debug('[autopilot] wave had no eligible tracks -> SoundCloud related');
  try {
    const related = await fetchRelatedTracks(
      seed.relatedTrack.urn,
      CANDIDATE_POOL_SIZE,
      0,
      options.signal,
    );
    if (!options.isCurrent()) return null;
    const tracks = curateQueueRecommendations(
      related.collection,
      existingQueue,
      preferences,
      context,
    );
    return tracks.length > 0 ? { source: 'related', tracks } : null;
  } catch (error) {
    if (options.signal.aborted) throw error;
    console.debug('[autopilot] SoundCloud related fetch failed:', error);
    return null;
  }
}
