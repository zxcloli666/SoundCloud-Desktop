import type { Howl } from 'howler';
import type { Track } from '../../../api/types.ts';
import { streamUrl } from '../../../lib/http';
import { usePlayerStore } from '../../../stores/player';
import {
  preloadQueueCache,
  preloadTrackCache,
  resolvePlaybackSource,
  warmupTrackCache,
} from './cachePlayback';
import { createTrackHowl, destroyHowlInstance, setHowlVolume } from './playerEngine';
import { createProgressLoop } from './progressLoop';
import { autoplayRelated } from './queueAutoplay';

let started = false;
let unsubscribeStore: (() => void) | null = null;
let currentHowl: Howl | null = null;
let currentUrn: string | null = null;

const progressLoop = createProgressLoop({
  getHowl: () => currentHowl,
  getState: () => usePlayerStore.getState(),
  onProgress: (seconds) => usePlayerStore.getState().setProgress(seconds),
});

function destroyCurrentHowl() {
  progressLoop.stop();
  currentHowl = destroyHowlInstance(currentHowl);
}

function createAndAssignHowl(src: string, urn: string, onFail?: () => void) {
  const howl = createTrackHowl({
    src,
    volume: usePlayerStore.getState().volume,
    onPlay: () => progressLoop.start(),
    onPause: () => progressLoop.stop(),
    onStop: () => progressLoop.stop(),
    onLoad: (duration) => {
      if (currentUrn !== urn) return;
      if (duration > 0) usePlayerStore.getState().setDuration(duration);
    },
    onEnd: () => {
      if (currentUrn !== urn) return;
      progressLoop.stop();
      handleTrackEnd();
    },
    onLoadError: (error) => {
      console.error(`[Audio] Load error (${src.slice(0, 60)}):`, error);
      if (currentUrn !== urn) return;
      if (onFail) onFail();
      else usePlayerStore.getState().pause();
    },
    onPlayError: (error) => {
      console.error(`[Audio] Play error (${src.slice(0, 60)}):`, error);
      if (currentUrn !== urn) return;
      if (onFail) onFail();
      else usePlayerStore.getState().pause();
    },
  });

  currentHowl = howl;

  if (usePlayerStore.getState().isPlaying) {
    howl.play();
  }
}

async function loadTrack(track: Track) {
  destroyCurrentHowl();
  currentUrn = track.urn;
  const urn = track.urn;

  usePlayerStore.getState().setProgress(0);
  usePlayerStore.getState().setDuration(track.duration / 1000);

  const source = await resolvePlaybackSource(urn);
  if (currentUrn !== urn) return;

  const stream = streamUrl(urn);

  const fallbackToStream = () => {
    if (currentUrn !== urn) return;
    console.log(`[Audio] Falling back to stream: ${urn}`);
    destroyCurrentHowl();
    createAndAssignHowl(stream, urn);
  };

  if (source.type === 'cache') {
    console.log(`[Audio] Cache hit (local server): ${urn}`);
    createAndAssignHowl(source.url, urn, fallbackToStream);
    return;
  }

  if (source.type === 'cache-no-server') {
    console.log(`[Audio] Cache hit (stream fallback, no server port): ${urn}`);
    createAndAssignHowl(stream, urn);
    return;
  }

  console.log(`[Audio] Stream: ${urn}`);
  createAndAssignHowl(stream, urn);
  warmupTrackCache(urn);
}

function handleTrackEnd() {
  const state = usePlayerStore.getState();

  if (state.repeat === 'one') {
    currentHowl?.seek(0);
    currentHowl?.play();
    return;
  }

  const { queue, queueIndex, shuffle } = state;
  const isLast = !shuffle && queueIndex >= queue.length - 1;

  if (isLast && state.repeat === 'off' && queue.length > 0) {
    void autoplayRelated(queue[queueIndex]);
    return;
  }

  usePlayerStore.getState().next();
}

export function startAudioRuntime() {
  if (started) return;
  started = true;

  unsubscribeStore = usePlayerStore.subscribe((state, prev) => {
    const trackChanged = state.currentTrack?.urn !== currentUrn;
    const playToggled = state.isPlaying !== prev.isPlaying;

    if (trackChanged) {
      if (state.currentTrack) {
        void loadTrack(state.currentTrack);
      } else {
        destroyCurrentHowl();
        currentUrn = null;
      }
      return;
    }

    if (playToggled) {
      if (state.isPlaying) {
        if (!currentHowl && state.currentTrack) {
          void loadTrack(state.currentTrack);
        } else if (currentHowl && !currentHowl.playing()) {
          currentHowl.play();
        }
      } else if (currentHowl?.playing()) {
        currentHowl.pause();
      }
    }

    if (state.seekRequest !== null && state.seekRequest !== prev.seekRequest) {
      currentHowl?.seek(state.seekRequest);
      usePlayerStore.getState().clearSeek();
    }

    if (state.volume !== prev.volume) {
      setHowlVolume(currentHowl, state.volume);
    }
  });
}

export function stopAudioRuntime() {
  if (!started) return;
  started = false;

  unsubscribeStore?.();
  unsubscribeStore = null;
  destroyCurrentHowl();
}

export function preloadTrack(urn: string) {
  preloadTrackCache(urn);
}

export function preloadQueue() {
  const { queue, queueIndex } = usePlayerStore.getState();
  preloadQueueCache(queue, queueIndex);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopAudioRuntime();
  });
}
