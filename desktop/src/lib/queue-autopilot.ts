/**
 * Single end-of-queue continuation path.
 *
 * Likes/playlists are exhausted first. Afterwards one cursor-backed SmartWave
 * session keeps its original positive seed for the whole autoplay run, while
 * every batch is locally filtered and reranked before it reaches the player.
 */

import {
  getPlayerQueueRevision,
  type QueueAdvanceReason,
  setEndOfQueueFallback,
  setPlaybackContextResetHandler,
  type Track,
  usePlayerStore,
} from '../stores/player';
import { chooseAutopilotContinuationSeed } from './autopilot-seed';
import { markAutopilotWaveTracks, resetAutopilotWaveSession } from './autopilot-wave-session';
import { setQueueContinuationSource } from './queue-continuation';
import { fetchQueueRecommendationContinuation } from './queue-recommendation-fetch';
import { continueFromQueueContext } from './queue-source-continuation';

interface AutopilotRun {
  controller: AbortController;
  generation: number;
  id: number;
  lastUrn: string;
  queue: Track[];
  queueIndex: number;
  queueRevision: number;
}

let activeRun: AutopilotRun | null = null;
let playbackGeneration = 0;
let runSequence = 0;

function isRunCurrent(run: AutopilotRun): boolean {
  const state = usePlayerStore.getState();
  return (
    !run.controller.signal.aborted &&
    run.generation === playbackGeneration &&
    getPlayerQueueRevision() === run.queueRevision &&
    state.queueIndex === run.queueIndex &&
    state.currentTrack?.urn === run.lastUrn &&
    state.repeat === 'off'
  );
}

export async function autopilotContinueFromTrack(
  lastTrack: Track,
  reason: QueueAdvanceReason = 'manual',
): Promise<void> {
  if (activeRun) {
    if (isRunCurrent(activeRun)) {
      console.debug('[autopilot] skipping duplicate refill');
      return;
    }
    activeRun.controller.abort();
    activeRun = null;
    resetAutopilotWaveSession();
  }

  const state = usePlayerStore.getState();
  const run: AutopilotRun = {
    controller: new AbortController(),
    generation: playbackGeneration,
    id: ++runSequence,
    lastUrn: lastTrack.urn,
    queue: state.queue,
    queueIndex: state.queueIndex,
    queueRevision: getPlayerQueueRevision(),
  };
  activeRun = run;

  try {
    const context = await continueFromQueueContext(run.queue, () => isRunCurrent(run));
    if (context === 'continued' || context === 'stale' || !isRunCurrent(run)) return;

    const seed = chooseAutopilotContinuationSeed(lastTrack, reason, run.queue, run.queueIndex);
    console.debug('[autopilot] recommendation continuation from', seed.wave);
    const continuation = await fetchQueueRecommendationContinuation(seed, {
      signal: run.controller.signal,
      isCurrent: () => isRunCurrent(run),
    });
    if (!isRunCurrent(run)) return;
    if (!continuation || continuation.tracks.length === 0) {
      console.warn('[autopilot] no eligible continuation tracks');
      usePlayerStore.getState().pause();
      return;
    }

    console.debug(
      '[autopilot] adding',
      continuation.tracks.length,
      continuation.source,
      'tracks to queue',
    );
    if (continuation.source === 'wave') {
      markAutopilotWaveTracks(continuation.tracks.map((track) => track.urn));
    }
    usePlayerStore.getState().appendToQueueAndPlayNext(continuation.tracks);
  } catch (error) {
    if (!run.controller.signal.aborted && isRunCurrent(run)) {
      console.error('[autopilot] continuation failed:', error);
      usePlayerStore.getState().pause();
    }
  } finally {
    if (activeRun?.id === run.id) activeRun = null;
  }
}

function resetPlaybackContext(): void {
  playbackGeneration += 1;
  activeRun?.controller.abort();
  activeRun = null;
  resetAutopilotWaveSession();
  setQueueContinuationSource(null);
}

setEndOfQueueFallback(autopilotContinueFromTrack);
setPlaybackContextResetHandler(resetPlaybackContext);
