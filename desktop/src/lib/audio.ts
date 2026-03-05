import { Howl } from 'howler';
import { streamUrl, api } from './api';
import { getCacheFilePath, getCacheUrl, fetchAndCacheTrack, isCached } from './cache';
import { usePlayerStore } from '../stores/player';
import type { Track } from '../stores/player';

function toHowlerVolume(v: number) {
  return Math.min(1, Math.max(0, v / 200));
}

let currentHowl: Howl | null = null;
let currentUrn: string | null = null;

function destroyHowl() {
  if (currentHowl) {
    currentHowl.off();
    currentHowl.stop();
    currentHowl.unload();
    currentHowl = null;
  }
}

function createHowl(src: string, urn: string, onFail?: () => void): Howl {
  const howl = new Howl({
    src: [src],
    html5: true,
    format: ['mp3'],
    volume: toHowlerVolume(usePlayerStore.getState().volume),
    onplay: () => updateProgress(),
    onload: () => {
      if (currentUrn !== urn) return;
      const d = howl.duration();
      if (d > 0) usePlayerStore.getState().setDuration(d);
    },
    onend: () => {
      if (currentUrn !== urn) return;
      handleTrackEnd();
    },
    onloaderror: (_id, error) => {
      console.error(`[Audio] Load error (${src.slice(0, 60)}):`, error);
      if (currentUrn !== urn) return;
      if (onFail) {
        onFail();
      } else {
        usePlayerStore.getState().pause();
      }
    },
    onplayerror: (_id, error) => {
      console.error(`[Audio] Play error (${src.slice(0, 60)}):`, error);
      if (currentUrn !== urn) return;
      if (onFail) {
        onFail();
      } else {
        usePlayerStore.getState().pause();
      }
    },
  });
  return howl;
}

async function loadTrack(track: Track) {
  destroyHowl();
  currentUrn = track.urn;
  const urn = track.urn;

  usePlayerStore.getState().setProgress(0);
  usePlayerStore.getState().setDuration(track.duration / 1000);

  const cachedPath = await getCacheFilePath(urn);
  if (currentUrn !== urn) return;

  const httpUrl = streamUrl(urn);

  const playHowl = (howl: Howl) => {
    currentHowl = howl;
    if (usePlayerStore.getState().isPlaying) howl.play();
  };

  const fallbackToStream = () => {
    if (currentUrn !== urn) return;
    console.log(`[Audio] Falling back to stream: ${urn}`);
    destroyHowl();
    playHowl(createHowl(httpUrl, urn));
  };

  if (cachedPath) {
    const cacheUrl = getCacheUrl(urn);
    if (cacheUrl) {
      console.log(`[Audio] Cache hit (local server): ${urn}`);
      playHowl(createHowl(cacheUrl, urn, fallbackToStream));
    } else {
      console.log(`[Audio] Cache hit (stream fallback, no server port): ${urn}`);
      playHowl(createHowl(httpUrl, urn));
    }
  } else {
    console.log(`[Audio] Stream: ${urn}`);
    playHowl(createHowl(httpUrl, urn));
    fetchAndCacheTrack(urn).catch(() => {});
  }
}

function updateProgress() {
  if (!currentHowl || !currentHowl.playing()) return;
  const seek = currentHowl.seek();
  if (usePlayerStore.getState().seekRequest === null) {
    usePlayerStore.getState().setProgress(seek);
  }
  requestAnimationFrame(updateProgress);
}

function handleTrackEnd() {
  const state = usePlayerStore.getState();
  if (state.repeat === 'one') {
    currentHowl?.seek(0);
    currentHowl?.play();
  } else {
    const { queue, queueIndex, shuffle } = state;
    const isLast = !shuffle && queueIndex >= queue.length - 1;
    if (isLast && state.repeat === 'off' && queue.length > 0) {
      void autoplayRelated(queue[queueIndex]);
    } else {
      usePlayerStore.getState().next();
    }
  }
}

// Subscribe to store changes
usePlayerStore.subscribe((state, prev) => {
  const trackChanged = state.currentTrack?.urn !== currentUrn;
  const playToggled = state.isPlaying !== prev.isPlaying;

  // Track change
  if (trackChanged) {
    if (state.currentTrack) {
      void loadTrack(state.currentTrack);
    } else {
      destroyHowl();
      currentUrn = null;
    }
    return;
  }

  // Play / Pause
  if (playToggled && !trackChanged) {
    if (state.isPlaying) {
      if (!currentHowl && state.currentTrack) {
        void loadTrack(state.currentTrack);
      } else {
        currentHowl?.play();
      }
    } else {
      currentHowl?.pause();
    }
  }

  // Seek
  if (state.seekRequest !== null && state.seekRequest !== prev.seekRequest) {
    if (currentHowl) {
      currentHowl.seek(state.seekRequest);
    }
    usePlayerStore.getState().clearSeek();
  }

  // Volume
  if (state.volume !== prev.volume && currentHowl) {
    currentHowl.volume(toHowlerVolume(state.volume));
  }
});

/* ── Autoplay ─────────────────────────────────────────────────── */

let autoplayLoading = false;
async function autoplayRelated(lastTrack: Track) {
  if (autoplayLoading) return;
  autoplayLoading = true;

  try {
    const { queue } = usePlayerStore.getState();
    const existingUrns = new Set(queue.map((t) => t.urn));

    const res = await api<{ collection: Track[] }>(
      `/tracks/${encodeURIComponent(lastTrack.urn)}/related?limit=20`,
    );

    const fresh = res.collection.filter((t) => !existingUrns.has(t.urn));
    if (fresh.length === 0) return;

    usePlayerStore.getState().addToQueue(fresh);
    usePlayerStore.getState().next();
  } catch (e) {
    console.error('Autoplay related failed:', e);
    usePlayerStore.getState().pause();
  } finally {
    autoplayLoading = false;
  }
}

/* ── Preloading ─────────────────────────────────────────────── */

let preloadTimer: ReturnType<typeof setTimeout> | null = null;

export function preloadTrack(urn: string) {
  if (preloadTimer) clearTimeout(preloadTimer);
  preloadTimer = setTimeout(() => {
    isCached(urn).then((hit) => {
      if (!hit) fetchAndCacheTrack(urn).catch(() => {});
    });
  }, 300);
}

export function preloadQueue() {
  const { queue, queueIndex } = usePlayerStore.getState();
  for (let i = 1; i <= 2; i++) {
    const idx = queueIndex + i;
    if (idx < queue.length) {
      const urn = queue[idx].urn;
      isCached(urn).then((hit) => {
        if (!hit) fetchAndCacheTrack(urn).catch(() => {});
      });
    }
  }
}
