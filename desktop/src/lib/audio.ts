import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import i18n from '../i18n';
import type { Track } from '../stores/player';
import { usePlayerStore } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import {
  api,
  buildStorageUrls,
  downloadFallbackUrls,
  getSessionId,
  resolveTrackFromStreaming,
  streamFallbackUrls,
} from './api';
import {
  buildTrackRequest,
  cancelTrackDownload,
  ensureTrackCached,
  getCacheInfo,
  removeCachedTrack,
} from './cache';
import { SEND_BEHAVIORAL_DATA } from './constants';
import { trackedInvoke as invoke } from './diagnostics';
import { isUrnDisliked } from './dislikes';
import { recordEvent } from './events';
import { art } from './formatters';
import { rememberTracks } from './offline-index';
import { getUrnCluster, recordClusterFeedback } from './recsFeedback';
import { getArtistDisplay, getDisplayTitle } from './track-display';

const SKIP_THRESHOLD_SEC = 30;
/** Минимум, чтобы засчитать «прослушано полностью» для коротких треков (50% длительности). */
const FULL_PLAY_RATIO = 0.5;
/** Битый кеш: сыграло меньше этого на треке от EARLY_END_MIN_EXPECTED_SEC — лечим перекачкой. */
const EARLY_END_PLAYED_SEC = 10;
const EARLY_END_MIN_EXPECTED_SEC = 30;
/** Один лечебный перекач на урн за сессию — защита от лупа на 30s-превью и мёртвых источниках. */
const healedUrns = new Set<string>();

/* ── Audio engine state ──────────────────────────────────────── */

let currentUrn: string | null = null;
let hasTrack = false;
let fallbackDuration = 0;
let cachedTime = 0;
let cachedDuration = 0;
let downloadProgress: number | null = null;
let loadGen = 0;
let lastEndedUrn: string | null = null;
let metadataAbort: AbortController | null = null;
const listeners = new Set<() => void>();
const API_PREVIEW_DURATION_MS = 30_000;

// The 10Hz tick fan-out drives every UI subscriber (progress, waveform clip-path,
// time readouts). When the window is hidden it's pure waste — the WebView doesn't
// throttle us, and MediaSession/Discord presence run off Rust events, not this.
// cachedTime/cachedDuration keep updating; we just skip the DOM-touching fan-out.
function notify() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  for (const l of listeners) l();
}

// Re-sync subscribers the moment the window comes back, so nothing shows a stale frame.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      for (const l of listeners) l();
    }
  });
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrentTime(): number {
  return cachedTime;
}

export function getDuration(): number {
  return cachedDuration;
}

export function getDownloadProgress(): number | null {
  return downloadProgress;
}

function setDownloadProgress(value: number | null): void {
  if (downloadProgress === value) return;
  downloadProgress = value;
  notify();
}

export function seek(seconds: number) {
  if (!hasTrack) return;
  invoke('audio_seek', { position: seconds }).catch(console.error);
  cachedTime = seconds;
  notify();
  setTimeout(() => updateMediaPosition(), 150);
}

export function handlePrev() {
  if (getCurrentTime() > 3) {
    seek(0);
  } else {
    usePlayerStore.getState().prev();
  }
}

/* ── Native audio control ────────────────────────────────────── */

async function stopTrack() {
  await invoke('audio_stop').catch(console.error);
  hasTrack = false;
  cachedTime = 0;
}

export async function switchAudioDevice(deviceName: string | null, manual = false) {
  if (manual) {
    await invoke('audio_set_follow_default_output', { follow: deviceName == null });
  }

  await invoke('audio_switch_device', { deviceName });
}

/** Reload the current track on new audio device, preserving position */
export async function reloadCurrentTrack() {
  const track = usePlayerStore.getState().currentTrack;
  if (!track) return;
  const wasPlaying = usePlayerStore.getState().isPlaying;
  const pos = cachedTime;
  await loadTrack(track);
  if (pos > 0) seek(pos);
  if (!wasPlaying) invoke('audio_pause').catch(console.error);
}

function getLoadErrorText(error: unknown): string | null {
  let message: string | null = null;

  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error) {
    if ('message' in error && typeof error.message === 'string') {
      message = error.message;
    } else if ('error' in error && typeof error.error === 'string') {
      message = error.error;
    }
  }

  if (!message) {
    const fallback = String(error).trim();
    if (fallback && fallback !== '[object Object]') {
      message = fallback;
    }
  }

  if (!message) return null;

  const normalized = message
    .trim()
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Command [^:]+ failed:\s*/i, '');

  const unquoted =
    normalized.startsWith('"') && normalized.endsWith('"')
      ? normalized.slice(1, -1).trim()
      : normalized;

  const sanitized = unquoted
    .replace(/\bhttps?:\/\/[^\s"')\]]+/gi, '')
    .replace(/\bscproxy:\/\/[^\s"')\]]+/gi, '')
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~-]+/gi, '$1 [redacted]')
    .replace(
      /\b(oauth_token|token|sig|signature|client_id|x-session-id)=([^&\s]+)/gi,
      '$1=[redacted]',
    )
    .replace(/\s+\bfrom\b\s*(?=$|[):;,.])/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([):;,.])/g, '$1')
    .trim();

  return sanitized || null;
}

type TrackMetadataPatch = Partial<Track> & {
  full_duration?: number;
};

function getResolvedDurationMs(track: {
  duration?: number;
  full_duration?: number;
}): number | null {
  if (typeof track.full_duration === 'number' && track.full_duration > 0) {
    return track.full_duration;
  }
  if (typeof track.duration === 'number' && track.duration > 0) {
    return track.duration;
  }
  return null;
}

function getPreviewResolveUrl(track: Pick<Track, 'duration' | 'permalink_url'>): string | null {
  if (track.duration !== API_PREVIEW_DURATION_MS || !track.permalink_url) {
    return null;
  }

  try {
    const url = new URL(track.permalink_url);
    return url.hostname.endsWith('soundcloud.com') ? url.toString() : null;
  } catch {
    return null;
  }
}

function mergeTrackMetadata(base: Track, patch: TrackMetadataPatch): Track {
  const resolvedDuration = getResolvedDurationMs(patch);

  return {
    ...base,
    ...patch,
    duration:
      resolvedDuration == null ||
      (resolvedDuration === API_PREVIEW_DURATION_MS && base.duration > API_PREVIEW_DURATION_MS)
        ? base.duration
        : resolvedDuration,
    permalink_url: patch.permalink_url ?? base.permalink_url,
    user: patch.user ? { ...base.user, ...patch.user } : base.user,
  };
}

function commitTrackMetadata(track: Track) {
  usePlayerStore.getState().replaceTrackMetadata(track);
  void rememberTracks([track]);

  if (currentUrn !== track.urn) return;

  if (track.duration <= 0) {
    updateMetadata(track);
    return;
  }

  const durationSecs = track.duration / 1000;
  fallbackDuration = durationSecs;
  cachedDuration = durationSecs;
  updateMetadata(track, durationSecs);
  notify();
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && /abort|cancel/i.test(error.message))
  );
}

async function fetchFreshTrackMetadata(track: Track, signal: AbortSignal): Promise<Track> {
  try {
    const freshTrack = await api<Track>(`/tracks/${encodeURIComponent(track.urn)}`, { signal });
    return mergeTrackMetadata(track, freshTrack);
  } catch (error) {
    if (signal.aborted || isAbortError(error)) return track;
    console.warn('[Audio] Failed to hydrate track metadata:', error);
    return track;
  }
}

async function resolveTrackMetadata(track: Track, signal: AbortSignal): Promise<Track> {
  const resolveUrl = getPreviewResolveUrl(track);
  if (!resolveUrl) return track;

  try {
    const resolvedTrack = await resolveTrackFromStreaming(resolveUrl, signal);
    return mergeTrackMetadata(track, resolvedTrack);
  } catch (error) {
    if (signal.aborted || isAbortError(error)) return track;
    console.warn('[Audio] Failed to resolve preview duration:', error);
    return track;
  }
}

/** True when a file path no longer exists on disk. */
function isFileMissing(e: unknown): boolean {
  const s = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
  return /no such file|os error 2|cannot find the (file|path)|system cannot find/i.test(s);
}

/**
 * Load a cached file, surviving the raw-А → clean-Б transcode swap: if the path
 * was deleted between cache-resolve and read, re-resolve through the cache (the
 * clean file now, or a fresh download) and retry once.
 */
async function loadCachedFile(
  urn: string,
  path: string,
  startPaused: boolean,
  reResolve: () => Promise<string | null>,
): Promise<{ duration_secs: number | null }> {
  try {
    return await invoke<{ duration_secs: number | null }>('audio_load_file', {
      path,
      cacheKey: urn,
      startPaused,
    });
  } catch (e) {
    if (!isFileMissing(e)) throw e;
    console.warn('[Audio] cached file vanished, re-resolving:', urn);
    const fresh = await reResolve();
    if (!fresh) throw e;
    return await invoke<{ duration_secs: number | null }>('audio_load_file', {
      path: fresh,
      cacheKey: urn,
      startPaused,
    });
  }
}

async function loadTrack(track: Track) {
  const gen = ++loadGen;
  const previousUrn = currentUrn;
  metadataAbort?.abort();
  const metadataController = new AbortController();
  metadataAbort = metadataController;
  if (previousUrn && previousUrn !== track.urn) {
    void cancelTrackDownload(previousUrn).catch(console.error);
  }
  const isNewTrack = currentUrn !== track.urn;
  await stopTrack();
  if (gen !== loadGen) return;
  currentUrn = track.urn;
  const urn = track.urn;

  // A-B loop is per-track: drop it only when loading a genuinely different track —
  // NOT on same-track reloads (repeat-one, device/EQ reload, or the loop's own
  // restart). Done here, after currentUrn is advanced, so the resulting store
  // notification doesn't re-enter the track-changed branch of the subscriber.
  if (isNewTrack && usePlayerStore.getState().abLoop) {
    usePlayerStore.getState().clearAbLoop();
  }

  void hydrateTrackMetadata(track, gen, metadataController);

  fallbackDuration = track.duration / 1000;
  cachedDuration = fallbackDuration;
  cachedTime = 0;
  setDownloadProgress(null);
  usePlayerStore.getState().setPlaybackTransport(null, null);
  notify();

  // Sync EQ state to Rust
  const { eqEnabled, eqGains, normalizeVolume } = useSettingsStore.getState();
  invoke('audio_set_eq', { enabled: eqEnabled, gains: eqGains }).catch(console.error);
  invoke('audio_set_normalization', { enabled: normalizeVolume }).catch(console.error);

  // Sync volume + playback rate (pitch is folded into the speed value sent to Rust)
  invoke('audio_set_volume', { volume: usePlayerStore.getState().volume }).catch(console.error);
  invoke('audio_set_playback_rate', { rate: getEffectivePlaybackRate() }).catch(console.error);

  try {
    const highQualityStreaming = useSettingsStore.getState().highQualityStreaming;

    // The cached file can be swapped (raw А → clean Б) or evicted between resolve
    // and read; re-resolve through the cache to recover the current path.
    const reResolve = async (): Promise<string | null> => {
      const info = await getCacheInfo(urn);
      if (info?.path) return info.path;
      try {
        return (await ensureTrackCached(urn, highQualityStreaming, track.duration)).path;
      } catch {
        return null;
      }
    };

    // Strategy 1: Cache hit — instant
    const cached = await getCacheInfo(urn);
    if (cached?.path) {
      if (gen !== loadGen) return;
      usePlayerStore.getState().setPlaybackTransport(cached.quality, cached.source);
      console.log('[Audio] Playing from cache:', urn);
      const loadResult = await loadCachedFile(
        urn,
        cached.path,
        !usePlayerStore.getState().isPlaying,
        reResolve,
      );
      if (gen !== loadGen) return;
      if (loadResult?.duration_secs) {
        fallbackDuration = loadResult.duration_secs;
        cachedDuration = loadResult.duration_secs;
        updateMetadata(track, loadResult.duration_secs);
        notify();
      }
      afterLoad(track, gen);
      return;
    }

    // Strategy 2: start from a small progressive/HLS buffer while Rust keeps
    // receiving the track and commits the same bytes to the regular cache.
    setDownloadProgress(0);

    try {
      await cancelTrackDownload(urn);
      if (gen !== loadGen || currentUrn !== urn) return;
      const startFastStream = async (hq: boolean) => {
        const request = await buildTrackRequest(urn, hq, track.duration);
        return invoke<{
          duration_secs: number | null;
          quality: 'hq' | 'sq';
          source: 'direct' | 'api';
        }>('audio_load_streaming', {
          request,
          startPaused: !usePlayerStore.getState().isPlaying,
        });
      };

      let streamed: {
        duration_secs: number | null;
        quality: 'hq' | 'sq';
        source: 'direct' | 'api';
      };
      try {
        streamed = await startFastStream(highQualityStreaming);
      } catch (error) {
        if (!highQualityStreaming) throw error;
        console.warn('[Audio] HQ fast stream failed, retrying standard quality:', error);
        if (gen !== loadGen || currentUrn !== urn) return;
        streamed = await startFastStream(false);
      }
      if (gen !== loadGen || currentUrn !== urn) return;
      setDownloadProgress(null);
      usePlayerStore.getState().setPlaybackTransport(streamed.quality, streamed.source);
      console.log('[Audio] Fast stream started:', urn);
      afterLoad(track, gen);
      return;
    } catch (error) {
      if (gen !== loadGen || currentUrn !== urn) return;
      throw error;
    }
  } catch (e) {
    console.error('[Audio] Load failed:', e);
    setDownloadProgress(null);
    usePlayerStore.getState().setPlaybackTransport(null, null);
    if (gen !== loadGen) return;
    const errorText = getLoadErrorText(e);
    toast.error(i18n.t('track.loadError'), {
      description: errorText ? `${track.title}: ${errorText}` : track.title,
    });
    usePlayerStore.getState().pause();
  }
}

function afterLoad(track: Track, gen: number) {
  if (gen !== loadGen) {
    invoke('audio_stop').catch(console.error);
    return;
  }
  hasTrack = true;

  const historyTrack =
    usePlayerStore.getState().currentTrack?.urn === track.urn
      ? usePlayerStore.getState().currentTrack
      : track;

  // Record to listening history (fire-and-forget), skip on repeat-one (same track looping)
  if (
    SEND_BEHAVIORAL_DATA &&
    historyTrack?.urn &&
    historyTrack.title &&
    usePlayerStore.getState().repeat !== 'one'
  ) {
    api('/history', {
      method: 'POST',
      body: JSON.stringify({
        scTrackId: historyTrack.urn,
        title: getDisplayTitle(historyTrack),
        artistName: getArtistDisplay(historyTrack).primary || historyTrack.user?.username || '',
        artistUrn: historyTrack.user?.urn || null,
        artworkUrl: historyTrack.artwork_url || null,
        duration: historyTrack.duration || 0,
      }),
    }).catch(() => {});
  }

  const isPlaying = usePlayerStore.getState().isPlaying;
  invoke(isPlaying ? 'audio_play' : 'audio_pause').catch(console.error);
  updatePlaybackState(isPlaying);
  updateMediaPosition();
  preloadQueue();
}

async function hydrateTrackMetadata(track: Track, gen: number, controller: AbortController) {
  let nextTrack = await fetchFreshTrackMetadata(track, controller.signal);
  if (gen !== loadGen || currentUrn !== track.urn) return;

  nextTrack = await resolveTrackMetadata(nextTrack, controller.signal);
  if (gen !== loadGen || currentUrn !== track.urn) return;
  commitTrackMetadata(nextTrack);
  if (metadataAbort === controller) metadataAbort = null;
}

/** Трек «закончился» через пару секунд при заявленных минутах — в кеше битый
 *  файл (заголовок целый, данные обрезаны: легаси без .meta.json или яд из
 *  storage до серверного duration-гейта). Сносим файл и перекачиваем вместо
 *  тихого скипа на следующий. */
function maybeHealEarlyEnd(): boolean {
  if (!currentUrn || navigator.onLine === false) return false;
  const state = usePlayerStore.getState();
  const track = state.currentTrack;
  if (!track || track.urn !== currentUrn || state.abLoop) return false;
  if (track.duration / 1000 < EARLY_END_MIN_EXPECTED_SEC) return false;
  if (cachedTime >= EARLY_END_PLAYED_SEC) return false;
  if (healedUrns.has(track.urn)) return false;
  healedUrns.add(track.urn);
  console.warn(
    `[Audio] ended after ${cachedTime.toFixed(1)}s of ${(track.duration / 1000).toFixed(0)}s — purging cache and refetching:`,
    track.urn,
  );
  void removeCachedTrack(track.urn)
    .catch(() => {})
    .then(() => {
      if (usePlayerStore.getState().currentTrack?.urn === track.urn) {
        return loadTrack(track);
      }
    });
  return true;
}

function handleTrackEnd() {
  const state = usePlayerStore.getState();
  // A-B loop whose end sits at (or within a tick of) the track end: the Rust-side
  // loop can't catch it before the sink drains, so restart the segment from A here.
  if (state.abLoop?.b != null && state.currentTrack) {
    const track = state.currentTrack;
    const a = state.abLoop.a;
    // loadTrack bumps loadGen synchronously; capture it so that if the user switches
    // tracks during the (async) reload, this stale restart-seek is dropped instead of
    // jumping the newly-loaded track to A.
    const loadPromise = loadTrack(track);
    const gen = loadGen;
    void loadPromise.then(() => {
      if (gen === loadGen && usePlayerStore.getState().currentTrack?.urn === track.urn) {
        seek(a);
      }
    });
    return;
  }
  if (state.repeat === 'one') {
    // rodio sink is empty after track ends — must reload
    if (state.currentTrack) void loadTrack(state.currentTrack);
    return;
  }
  // Всегда через next(). Если упёрся в конец очереди — store сам позовёт
  // autopilot (см. setEndOfQueueFallback в lib/queue-autopilot.ts).
  // Clear currentUrn so subscriber detects change even if next track has same URN.
  currentUrn = null;
  usePlayerStore.getState().next();
}

/* ── Tauri event listeners ───────────────────────────────────── */

const hasTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const listenNative: typeof listen = hasTauriRuntime ? listen : async () => () => {};

listenNative<number>('audio:tick', (event) => {
  cachedTime = event.payload;
  if (cachedDuration <= 0) cachedDuration = fallbackDuration;
  notify();
});

listenNative<{ urn: string; progress: number }>('track:download-progress', (event) => {
  const { urn, progress } = event.payload;
  if (urn === currentUrn) {
    setDownloadProgress(progress >= 0.999 ? null : progress);
  }
});

listenNative('audio:ended', () => {
  if (maybeHealEarlyEnd()) return;
  if (currentUrn) {
    // Засчитываем full_play только если трек реально игрался: либо ≥30s,
    // либо проиграно ≥50% длительности (для коротких треков). Иначе это
    // зависшая загрузка / зеро-длительность баг — не отправляем.
    const playedEnough =
      cachedTime >= SKIP_THRESHOLD_SEC ||
      (cachedDuration > 0 && cachedTime >= cachedDuration * FULL_PLAY_RATIO);
    if (playedEnough) {
      const positionPct = cachedDuration > 0 ? Math.min(1, cachedTime / cachedDuration) : undefined;
      recordEvent('full_play', currentUrn, positionPct);
      const cluster = getUrnCluster(currentUrn);
      if (cluster) recordClusterFeedback(cluster, 'complete');
    }
    lastEndedUrn = currentUrn;
  }
  hasTrack = false;
  handleTrackEnd();
});

listenNative('audio:device-reconnected', () => {
  console.log('[Audio] Device reconnected');
});

listenNative<string>('audio:default-device-changed', (event) => {
  console.log(`[Audio] Default output changed to '${event.payload}'`);
});

/* ── Store subscriber ────────────────────────────────────────── */

usePlayerStore.subscribe((state, prev) => {
  const nextUrn = state.currentTrack?.urn ?? null;
  const trackChanged = nextUrn !== currentUrn;
  const playToggled = state.isPlaying !== prev.isPlaying;

  if (trackChanged) {
    const previousUrn = currentUrn;
    const previousTime = cachedTime;
    const previousHadTrack = hasTrack;

    if (
      previousUrn &&
      previousHadTrack &&
      previousTime < SKIP_THRESHOLD_SEC &&
      previousUrn !== lastEndedUrn
    ) {
      const previousDuration = cachedDuration > 0 ? cachedDuration : fallbackDuration;
      const positionPct = previousDuration > 0 ? previousTime / previousDuration : undefined;
      recordEvent('skip', previousUrn, positionPct);
    }
    lastEndedUrn = null;

    if (state.currentTrack) {
      // Автоскип дизлайкнутых треков: пропускаем без загрузки/плэя.
      if (isUrnDisliked(state.currentTrack.urn)) {
        loadGen += 1;
        metadataAbort?.abort();
        metadataAbort = null;
        if (previousUrn) void cancelTrackDownload(previousUrn).catch(console.error);
        currentUrn = null;
        fallbackDuration = 0;
        cachedDuration = 0;
        cachedTime = 0;
        hasTrack = false;
        usePlayerStore.getState().setPlaybackTransport(null, null);
        notify();
        usePlayerStore.getState().next();
        return;
      }
      updateMetadata(state.currentTrack);
      void loadTrack(state.currentTrack);
    } else {
      loadGen += 1;
      metadataAbort?.abort();
      metadataAbort = null;
      if (previousUrn) void cancelTrackDownload(previousUrn).catch(console.error);
      void stopTrack();
      currentUrn = null;
      fallbackDuration = 0;
      cachedDuration = 0;
      usePlayerStore.getState().setPlaybackTransport(null, null);
      notify();
    }
    return;
  }

  if (playToggled && !trackChanged) {
    if (state.isPlaying) {
      if (!hasTrack && state.currentTrack) {
        void loadTrack(state.currentTrack);
      } else {
        invoke('audio_play').catch(console.error);
      }
    } else {
      invoke('audio_pause').catch(console.error);
    }
    updatePlaybackState(state.isPlaying);
  }

  if (state.volume !== prev.volume) {
    invoke('audio_set_volume', { volume: state.volume }).catch(console.error);
  }

  if (
    state.playbackRate !== prev.playbackRate ||
    state.pitchSemitones !== prev.pitchSemitones ||
    state.pitchControlMode !== prev.pitchControlMode
  ) {
    invoke('audio_set_playback_rate', { rate: getEffectivePlaybackRate() }).catch(console.error);
  }

  // A-B loop: only push an active region (both bounds set); otherwise clear it.
  if (state.abLoop !== prev.abLoop) {
    const ab = state.abLoop;
    const active = ab != null && ab.b != null;
    invoke('audio_set_ab_loop', {
      a: active ? ab.a : null,
      b: active ? ab.b : null,
    }).catch(console.error);
  }
});

/** Combine playback rate and (manual) pitch into a single Rust-side speed value.
 *  Rust uses rodio's `set_speed` which couples tempo+pitch — so manual pitch is
 *  applied as a multiplier on top of the user's rate.
 */
function getEffectivePlaybackRate(): number {
  const { playbackRate, pitchControlMode, pitchSemitones } = usePlayerStore.getState();
  if (pitchControlMode === 'manual' && Math.abs(pitchSemitones) > 0.001) {
    return playbackRate * 2 ** (pitchSemitones / 12);
  }
  return playbackRate;
}

/* ── EQ settings subscriber ──────────────────────────────────── */

useSettingsStore.subscribe((state, prev) => {
  if (state.eqEnabled !== prev.eqEnabled || state.eqGains !== prev.eqGains) {
    invoke('audio_set_eq', { enabled: state.eqEnabled, gains: state.eqGains }).catch(console.error);
  }

  if (state.normalizeVolume !== prev.normalizeVolume) {
    invoke('audio_set_normalization', { enabled: state.normalizeVolume }).catch(console.error);
    if (usePlayerStore.getState().currentTrack) {
      void reloadCurrentTrack();
    }
  }
});

/* ── Native Media Controls (souvlaki: MPRIS/SMTC) ───────────── */

function updateMetadata(track: Track, durationSecs?: number) {
  const coverUrl = art(track.artwork_url, 't500x500') || undefined;
  const display = getArtistDisplay(track);
  const title = getDisplayTitle(track);
  invoke('audio_set_metadata', {
    title,
    artist: display.primary || track.user.username,
    coverUrl: coverUrl || null,
    durationSecs: durationSecs ?? track.duration / 1000,
  }).catch(console.error);
}

function updatePlaybackState(playing: boolean) {
  invoke('audio_set_playback_state', { playing }).catch(console.error);
}

function updateMediaPosition() {
  const pos = getCurrentTime();
  if (pos > 0) {
    invoke('audio_set_media_position', { position: pos }).catch(console.error);
  }
}

// Listen for media control events from souvlaki (MPRIS/SMTC)
listenNative('media:play', () => usePlayerStore.getState().resume());
listenNative('media:pause', () => usePlayerStore.getState().pause());
listenNative('media:toggle', () => usePlayerStore.getState().togglePlay());
listenNative('media:next', () => usePlayerStore.getState().next());
listenNative('media:prev', () => handlePrev());
listenNative<number>('media:seek', (e) => seek(e.payload));
listenNative<number>('media:seek-relative', (e) => {
  const offset = e.payload;
  if (offset > 0) {
    seek(Math.min(getCurrentTime() + offset, getDuration()));
  } else {
    seek(Math.max(getCurrentTime() + offset, 0));
  }
});

/* ── Preloading ──────────────────────────────────────────────── */

let preloadTimer: ReturnType<typeof setTimeout> | null = null;

export function preloadTrack(urn: string) {
  if (preloadTimer) clearTimeout(preloadTimer);
  preloadTimer = setTimeout(() => {
    const sessionId = getSessionId();
    const hq = useSettingsStore.getState().highQualityStreaming;
    invoke('track_preload', {
      entries: [
        {
          urn,
          urls: streamFallbackUrls(urn, hq),
          downloadUrls: downloadFallbackUrls(urn, hq),
          storageUrls: buildStorageUrls(urn),
          sessionId,
          hq,
        },
      ],
    }).catch(console.error);
  }, 500);
}

export function preloadQueue() {
  const { queue, queueIndex } = usePlayerStore.getState();
  const entries: Array<{
    urn: string;
    urls: string[];
    downloadUrls: string[];
    storageUrls: string[];
    sessionId: string | null;
    hq: boolean;
    durationMs?: number;
  }> = [];
  const sessionId = getSessionId();
  const hq = useSettingsStore.getState().highQualityStreaming;

  for (let i = 1; i <= 1; i++) {
    const idx = queueIndex + i;
    if (idx < queue.length) {
      entries.push({
        urn: queue[idx].urn,
        urls: streamFallbackUrls(queue[idx].urn, hq),
        downloadUrls: downloadFallbackUrls(queue[idx].urn, hq),
        storageUrls: buildStorageUrls(queue[idx].urn),
        sessionId,
        hq,
        durationMs: queue[idx].duration,
      });
    }
  }

  if (entries.length > 0) {
    invoke('track_preload', { entries }).catch(console.error);
  }
}

usePlayerStore.subscribe((state, prev) => {
  if (state.queueIndex !== prev.queueIndex || state.queue !== prev.queue) {
    preloadQueue();
  }
});
