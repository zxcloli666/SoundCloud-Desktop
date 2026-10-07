import {listen} from '@tauri-apps/api/event';
import {toast} from 'sonner';
import i18n from '../i18n';
import type {Track, TrackScdMeta} from '../stores/player';
import {playbackAllowed, usePlayerStore} from '../stores/player';
import {useSettingsStore} from '../stores/settings';
import {
  api,
  buildStorageUrls,
  downloadFallbackUrls,
  getSessionId,
  isHqStreaming,
  resolveTrackFromStreaming,
  streamFallbackUrls,
  wantsHqUpgrade,
} from './api';
import {
  enforceAudioCacheLimit,
  ensureTrackCached,
  expectedDurationMs,
  getCacheInfo,
  isAudioCacheDisabled,
  isHoverPreloadEnabled,
  markTrackPlayed,
  removeCachedTrack,
  type TrackCacheInfo,
  upgradeCachedTrack,
} from './cache';
import {trackedInvoke as invoke} from './diagnostics';
import {isUrnDisliked} from './dislikes';
import {recordEvent} from './events';
import {art} from './formatters';
import {trackUrn} from './ids';
import {
  bumpLoadWatch,
  resetSkipStreak,
  skipUnloadableEnabled,
  stopLoadWatch,
  takeSkipAttempt,
  watchLoad,
} from './load-watchdog';
import {localTrackPath, markLocalMissing, noteLocalDuration} from './local-import';
import {isLocalUrn} from './local-library';
import {rememberTracks} from './offline-index';
import {getUrnCluster, recordClusterFeedback} from './recsFeedback';
import {isPreviewOnly} from './track-access';
import {getArtistDisplay, getDisplayTitle} from './track-display';

const SKIP_THRESHOLD_SEC = 30;
const SLOW_LOAD_HINT_MS = 60_000;
/** Минимум, чтобы засчитать «прослушано полностью» для коротких треков (50% длительности). */
const FULL_PLAY_RATIO = 0.5;
const EARLY_END_MIN_EXPECTED_SEC = 30;
const EARLY_END_TOLERANCE_SEC = 4;
const EARLY_END_TOLERANCE_RATIO = 0.04;
const CROSSFADE_LEAD_SEC = 0.5;
/** Один лечебный перекач на урн за сессию — защита от лупа на 30s-превью и мёртвых источниках. */
const healedUrns = new Set<string>();

/* ── Audio engine state ──────────────────────────────────────── */

let currentUrn: string | null = null;
let hasTrack = false;
let fallbackDuration = 0;
let cachedTime = 0;
let cachedDuration = 0;
let acceptedShortFile = false;
let downloadProgress: number | null = null;
let loadGen = 0;
let lastEndedUrn: string | null = null;
let pendingCrossfadeMs = 0;
let crossfadeGen = -1;
let crossfadeCheckedGen = -1;
let startGate: ((urn: string) => Promise<number | null>) | null = null;
const listeners = new Set<() => void>();
const seekListeners = new Set<(seconds: number) => void>();
const API_PREVIEW_DURATION_MS = 30_000;

// The 10Hz tick fan-out drives every UI subscriber (progress, waveform clip-path,
// time readouts). When the window is hidden it's pure waste — the WebView doesn't
// throttle us, and MediaSession runs off Rust events, not this.
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

export function cancelTrackLoad(): void {
  loadGen++;
  stopLoadWatch();
  setDownloadProgress(null);
  usePlayerStore.getState().pause();
}

export function isTrackLoaded(): boolean {
  return hasTrack;
}

export function setStartGate(gate: ((urn: string) => Promise<number | null>) | null): void {
  startGate = gate;
}

export function subscribeSeek(listener: (seconds: number) => void): () => void {
  seekListeners.add(listener);
  return () => seekListeners.delete(listener);
}

export function seek(seconds: number) {
  if (!playbackAllowed('seek')) return;
  alignTo(seconds);
}

export function alignTo(seconds: number) {
  if (!hasTrack) return;
  invoke('audio_seek', { position: seconds }).catch(console.error);
  cachedTime = seconds;
  notify();
  setTimeout(() => updateMediaPosition(), 150);
  for (const listener of seekListeners) listener(seconds);
}

export function replayCurrent(): void {
  const track = usePlayerStore.getState().currentTrack;
  if (track) void loadTrack(track);
}

export function handlePrev() {
  if (getCurrentTime() > 3) {
    seek(0);
  } else {
    usePlayerStore.getState().prev();
  }
}

/* ── Native audio control ────────────────────────────────────── */

function stopTrack() {
  invoke('audio_stop').catch(console.error);
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
  if (pos > 0) alignTo(pos);
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

async function fetchFreshTrackMetadata(track: Track): Promise<Track> {
  try {
    const freshTrack = await api<Track>(`/tracks/${encodeURIComponent(track.urn)}`);
    return mergeTrackMetadata(track, freshTrack);
  } catch (error) {
    console.warn('[Audio] Failed to hydrate track metadata:', error);
    return track;
  }
}

async function resolveTrackMetadata(track: Track): Promise<Track> {
  const resolveUrl = getPreviewResolveUrl(track);
  if (!resolveUrl) return track;

  try {
    const resolvedTrack = await resolveTrackFromStreaming(resolveUrl);
    return mergeTrackMetadata(track, resolvedTrack);
  } catch (error) {
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
  crossfadeMs = 0,
): Promise<{ duration_secs: number | null }> {
  try {
    return await invoke<{ duration_secs: number | null }>('audio_load_file', {
      path,
      cacheKey: urn,
      startPaused,
      crossfadeMs: crossfadeMs > 0 ? crossfadeMs : null,
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

async function playLocalFile(track: Track, gen: number, resumeAt: number) {
  const path = await localTrackPath(track.urn);
  if (!path) throw new Error(i18n.t('local.fileMissing'));
  if (gen !== loadGen) return;
  const loadResult = await invoke<{ duration_secs: number | null }>('audio_load_file', {
    path,
    cacheKey: track.urn,
    startPaused: resumeAt > 0 || !usePlayerStore.getState().isPlaying,
  });
  if (gen !== loadGen) return;
  if (loadResult?.duration_secs) {
    fallbackDuration = loadResult.duration_secs;
    cachedDuration = loadResult.duration_secs;
    noteLocalDuration(track.urn, loadResult.duration_secs);
    updateMetadata(track, loadResult.duration_secs);
    notify();
  }
  await afterLoad(track, gen, resumeAt);
}

async function loadTrack(track: Track, resumeAt = 0) {
  const gen = ++loadGen;
  const isNewTrack = currentUrn !== track.urn;
  const crossfadeMs = pendingCrossfadeMs;
  pendingCrossfadeMs = 0;
  stopLoadWatch();
  if (crossfadeMs > 0) {
    crossfadeGen = gen;
    hasTrack = false;
    cachedTime = 0;
  } else {
    stopTrack();
  }
  currentUrn = track.urn;
  acceptedShortFile = false;
  const urn = track.urn;

  // A-B loop is per-track: drop it only when loading a genuinely different track —
  // NOT on same-track reloads (repeat-one, device/EQ reload, or the loop's own
  // restart). Done here, after currentUrn is advanced, so the resulting store
  // notification doesn't re-enter the track-changed branch of the subscriber.
  if (isNewTrack && usePlayerStore.getState().abLoop) {
    usePlayerStore.getState().clearAbLoop();
  }

  const local = isLocalUrn(urn);
  if (!local) void hydrateTrackMetadata(track, gen);

  fallbackDuration = track.duration / 1000;
  cachedDuration = fallbackDuration;
  cachedTime = 0;
  setDownloadProgress(null);
  usePlayerStore.getState().setPlaybackTransport(null, null);
  notify();

  // Sync EQ state to Rust
  const { eqEnabled, eqGains, normalizeVolume, skipSilence } = useSettingsStore.getState();
  invoke('audio_set_eq', { enabled: eqEnabled, gains: eqGains }).catch(console.error);
  invoke('audio_set_normalization', { enabled: normalizeVolume }).catch(console.error);
  invoke('audio_set_skip_silence', { enabled: skipSilence }).catch(console.error);

  invoke('audio_set_volume', { volume: usePlayerStore.getState().volume }).catch(console.error);
  syncPlaybackRateAndPitch();

  try {
    if (local) {
      await playLocalFile(track, gen, resumeAt);
      return;
    }

    const highQualityStreaming = isHqStreaming();
    const storageQuality = track._scd_meta?.storage_quality;

    // The cached file can be swapped (raw А → clean Б) or evicted between resolve
    // and read; re-resolve through the cache to recover the current path.
    const reResolve = async (): Promise<string | null> => {
      const info = await getCacheInfo(urn);
      if (info?.path) return info.path;
      try {
        return (
          await ensureTrackCached(
            urn,
            highQualityStreaming,
            expectedDurationMs(track),
            storageQuality,
          )
        ).path;
      } catch {
        return null;
      }
    };

    // Strategy 1: Cache hit — instant
    const cached = await getCacheInfo(urn);
    if (cached?.path) {
      if (gen !== loadGen) return;
      acceptedShortFile = cached.acceptedShort;
      usePlayerStore.getState().setPlaybackTransport(cached.quality, cached.source);
      console.log('[Audio] Playing from cache:', urn);
      if (cached.quality !== 'hq' && !cached.acceptedShort && wantsHqUpgrade()) {
        void upgradeCachedTrack(urn, expectedDurationMs(track), storageQuality).catch(console.error);
      }
      const loadResult = await loadCachedFile(
        urn,
        cached.path,
        resumeAt > 0 || !usePlayerStore.getState().isPlaying || startGate != null,
        reResolve,
        crossfadeMs,
      );
      if (gen !== loadGen) return;
      if (loadResult?.duration_secs) {
        fallbackDuration = loadResult.duration_secs;
        cachedDuration = loadResult.duration_secs;
        updateMetadata(track, loadResult.duration_secs);
        notify();
      }
      await afterLoad(track, gen, resumeAt);
      return;
    }

    // Strategy 2: Download full track to cache — Rust picks storage/API internally
    if (crossfadeMs > 0) invoke('audio_stop').catch(console.error);
    setDownloadProgress(0);
    watchLoad(() => {
      if (gen === loadGen) skipUnloadable(track, true);
    });
    setTimeout(() => {
      if (gen !== loadGen || downloadProgress !== 0) return;
      toast.info(i18n.t('track.slowLoad'), {
        description: `${track.title}: ${i18n.t('track.slowLoadHint')}`,
      });
    }, SLOW_LOAD_HINT_MS);

    let cachedInfo: TrackCacheInfo;
    try {
      cachedInfo = await ensureTrackCached(
        urn,
        highQualityStreaming,
        expectedDurationMs(track),
        storageQuality,
      );
    } catch (error) {
      const premiumRefused = getLoadErrorText(error)?.includes('HTTP 403 Forbidden: forbidden');
      if (!highQualityStreaming || !premiumRefused || gen !== loadGen) throw error;
      console.warn('[Audio] HQ load failed, retrying without hq:', error);
      setDownloadProgress(0);
      bumpLoadWatch();
      cachedInfo = await ensureTrackCached(urn, false, expectedDurationMs(track), storageQuality);
    }

    if (gen !== loadGen) return;
    stopLoadWatch();
    setDownloadProgress(null);
    acceptedShortFile = cachedInfo.acceptedShort;
    usePlayerStore.getState().setPlaybackTransport(cachedInfo.quality, cachedInfo.source);

    console.log('[Audio] Playing downloaded track:', urn);
    const loadResult = await loadCachedFile(
      urn,
      cachedInfo.path,
      resumeAt > 0 || !usePlayerStore.getState().isPlaying || startGate != null,
      reResolve,
    );
    if (loadResult?.duration_secs) {
      fallbackDuration = loadResult.duration_secs;
      cachedDuration = loadResult.duration_secs;
      updateMetadata(track, loadResult.duration_secs);
      notify();
    }
    if (gen !== loadGen) return;
    await afterLoad(track, gen, resumeAt);
  } catch (e) {
    console.error('[Audio] Load failed:', e);
    if (gen !== loadGen) return;
    if (crossfadeMs > 0) invoke('audio_stop').catch(console.error);
    stopLoadWatch();
    setDownloadProgress(null);
    usePlayerStore.getState().setPlaybackTransport(null, null);
    const localMissing = local && isFileMissing(e);
    if (localMissing) markLocalMissing(urn);
    const errorText = localMissing ? i18n.t('local.fileMissing') : getLoadErrorText(e);
    if (errorText?.includes('no stream available')) {
      toast.error(i18n.t('track.noStream'), {
        description: `${track.title}: ${i18n.t('track.noStreamHint')}`,
      });
    } else {
      toast.error(i18n.t('track.loadError'), {
        description: errorText ? `${track.title}: ${errorText}` : track.title,
      });
    }
    if (!skipUnloadable(track, false)) usePlayerStore.getState().pause();
  }
}

function skipUnloadable(track: Track, stuck: boolean): boolean {
  const player = usePlayerStore.getState();
  if (!player.isPlaying || player.currentTrack?.urn !== track.urn) return false;
  if (!skipUnloadableEnabled() || !playbackAllowed('skip')) return false;
  if (!takeSkipAttempt()) {
    toast.warning(i18n.t('track.skipHalted'), { description: i18n.t('track.skipHaltedHint') });
    player.pause();
    return true;
  }
  if (stuck) {
    console.warn('[Audio] load stalled, skipping:', track.urn);
    toast.warning(i18n.t('track.skippedStuck'), { description: track.title });
  }
  player.next();
  return usePlayerStore.getState().currentTrack?.urn !== track.urn;
}

async function afterLoad(track: Track, gen: number, resumeAt: number) {
  if (gen !== loadGen) {
    invoke('audio_stop').catch(console.error);
    return;
  }
  if (resumeAt > 0) {
    await invoke('audio_seek', { position: resumeAt }).catch(console.error);
    if (gen !== loadGen) return;
    cachedTime = resumeAt;
    notify();
  }
  hasTrack = true;
  void markTrackPlayed(track.urn)
    .catch(console.error)
    .finally(() => enforceAudioCacheLimit().catch(console.error));
  resetSkipStreak();

  const historyTrack =
    usePlayerStore.getState().currentTrack?.urn === track.urn
      ? usePlayerStore.getState().currentTrack
      : track;

  // Record to listening history (fire-and-forget), skip on repeat-one (same track looping)
  const historyUrn = trackUrn(historyTrack?.urn);
  if (historyUrn && historyTrack?.title && usePlayerStore.getState().repeat !== 'one') {
    api('/history', {
      method: 'POST',
      body: JSON.stringify({
        scTrackId: historyUrn,
        title: getDisplayTitle(historyTrack),
        artistName: getArtistDisplay(historyTrack).primary || historyTrack.user?.username || '',
        artistUrn: historyTrack.user?.urn || null,
        artworkUrl: historyTrack.artwork_url || null,
        duration: historyTrack.duration || 0,
      }),
    }).catch(() => {});
  }

  if (startGate) {
    const startAt = await startGate(track.urn).catch(() => null);
    if (gen !== loadGen) return;
    if (startAt != null) {
      await invoke('audio_seek', { position: startAt }).catch(console.error);
      if (gen !== loadGen) return;
      cachedTime = startAt;
      notify();
    }
  }

  const isPlaying = usePlayerStore.getState().isPlaying;
  invoke(isPlaying ? 'audio_play' : 'audio_pause').catch(console.error);
  updatePlaybackState(isPlaying);
  updateMediaPosition();
  preloadQueue();
}

async function hydrateTrackMetadata(track: Track, gen: number) {
  let nextTrack = await fetchFreshTrackMetadata(track);
  if (gen !== loadGen || currentUrn !== track.urn) return;

  nextTrack = await resolveTrackMetadata(nextTrack);
  if (gen !== loadGen || currentUrn !== track.urn) return;
  commitTrackMetadata(nextTrack);
}

function endedEarly(track: Track): boolean {
  if (isPreviewOnly(track)) return false;
  if (Math.abs(cachedTime - API_PREVIEW_DURATION_MS / 1000) < 2) return false;
  const expected = Math.max(cachedDuration, track.duration / 1000);
  if (expected < EARLY_END_MIN_EXPECTED_SEC) return false;
  const tolerance = Math.max(EARLY_END_TOLERANCE_SEC, expected * EARLY_END_TOLERANCE_RATIO);
  return cachedTime < expected - tolerance;
}

function maybeHealEarlyEnd(): boolean {
  if (!currentUrn || navigator.onLine === false) return false;
  const state = usePlayerStore.getState();
  const track = state.currentTrack;
  if (!track || track.urn !== currentUrn || state.abLoop || acceptedShortFile) return false;
  if (isLocalUrn(track.urn)) return false;
  if (!endedEarly(track)) return false;
  const endedAt = cachedTime;
  if (healedUrns.has(track.urn)) {
    console.warn(`[Audio] ended early again at ${endedAt.toFixed(1)}s, skipping:`, track.urn);
    toast.error(i18n.t('track.loadError'), {
      description: `${track.title}: ${i18n.t('track.fileDamaged')}`,
    });
    return false;
  }
  healedUrns.add(track.urn);
  console.warn(
    `[Audio] ended after ${endedAt.toFixed(1)}s of ${(track.duration / 1000).toFixed(0)}s — purging cache and refetching:`,
    track.urn,
  );
  void removeCachedTrack(track.urn)
    .catch(() => {})
    .then(() => {
      if (usePlayerStore.getState().currentTrack?.urn !== track.urn) return;
      return loadTrack(track, Math.max(0, endedAt - 1));
    });
  return true;
}

function handleTrackEnd() {
  if (!playbackAllowed('advance')) return;
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

function isCrossfadeLoading(): boolean {
  return crossfadeGen === loadGen && !hasTrack;
}

function upcomingTrack(): Track | null {
  const { queue, queueIndex, repeat } = usePlayerStore.getState();
  if (queueIndex + 1 < queue.length) return queue[queueIndex + 1];
  return repeat === 'all' && queue.length > 1 ? queue[0] : null;
}

function canCrossfade(): boolean {
  const state = usePlayerStore.getState();
  return state.isPlaying && state.repeat !== 'one' && !state.abLoop && startGate == null;
}

function maybeStartCrossfade() {
  const lengthSec = useSettingsStore.getState().crossfadeSec;
  if (lengthSec <= 0 || !hasTrack || !currentUrn || crossfadeCheckedGen === loadGen) return;
  const duration = cachedDuration > 0 ? cachedDuration : fallbackDuration;
  if (duration <= lengthSec * 2 || cachedTime < duration - lengthSec - CROSSFADE_LEAD_SEC) return;
  crossfadeCheckedGen = loadGen;
  const next = upcomingTrack();
  if (!canCrossfade() || !next || isUrnDisliked(next.urn)) return;
  const gen = loadGen;
  void getCacheInfo(next.urn).then((info) => {
    if (!info?.path || gen !== loadGen || !hasTrack || !currentUrn) return;
    if (!canCrossfade() || upcomingTrack()?.urn !== next.urn) return;
    recordFullPlay(currentUrn, true);
    lastEndedUrn = currentUrn;
    pendingCrossfadeMs = lengthSec * 1000;
    currentUrn = null;
    usePlayerStore.getState().next();
    pendingCrossfadeMs = 0;
  });
}

listen<number>('audio:tick', (event) => {
  if (isCrossfadeLoading()) return;
  cachedTime = event.payload;
  if (cachedDuration <= 0) cachedDuration = fallbackDuration;
  notify();
  maybeStartCrossfade();
});

listen<{ urn: string; progress: number }>('track:download-progress', (event) => {
  const { urn, progress } = event.payload;
  if (urn === currentUrn && downloadProgress !== null) {
    if (progress > downloadProgress) bumpLoadWatch();
    setDownloadProgress(Math.max(downloadProgress, progress));
  }
});

// Засчитываем full_play только если трек реально игрался: либо ≥30s,
// либо проиграно ≥50% длительности (для коротких треков). Иначе это
// зависшая загрузка / зеро-длительность баг — не отправляем.
function recordFullPlay(urn: string, complete: boolean) {
  const playedEnough =
    complete ||
    cachedTime >= SKIP_THRESHOLD_SEC ||
    (cachedDuration > 0 && cachedTime >= cachedDuration * FULL_PLAY_RATIO);
  if (!playedEnough) return;
  const positionPct = complete
    ? 1
    : cachedDuration > 0
      ? Math.min(1, cachedTime / cachedDuration)
      : undefined;
  recordEvent('full_play', urn, positionPct);
  const cluster = getUrnCluster(urn);
  if (cluster) recordClusterFeedback(cluster, 'complete');
}

listen<boolean | null>('audio:ended', (event) => {
  if (isCrossfadeLoading()) return;
  const silentTail = event.payload === true;
  if (!silentTail && maybeHealEarlyEnd()) return;
  if (currentUrn) {
    recordFullPlay(currentUrn, silentTail);
    lastEndedUrn = currentUrn;
  }
  hasTrack = false;
  handleTrackEnd();
});

listen('audio:device-reconnected', () => {
  console.log('[Audio] Device reconnected');
});

listen<string>('audio:default-device-changed', (event) => {
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
      if (isUrnDisliked(state.currentTrack.urn) && playbackAllowed('advance')) {
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
      stopTrack();
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
    syncPlaybackRateAndPitch();
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

function syncPlaybackRateAndPitch() {
  const { playbackRate, pitchControlMode, pitchSemitones } = usePlayerStore.getState();
  const ratio = pitchControlMode === 'manual' ? 2 ** (pitchSemitones / 12) / playbackRate : 1;
  invoke('audio_set_pitch_ratio', { ratio }).catch(console.error);
  invoke('audio_set_playback_rate', { rate: playbackRate }).catch(console.error);
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

  if (state.skipSilence !== prev.skipSilence) {
    invoke('audio_set_skip_silence', { enabled: state.skipSilence }).catch(console.error);
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
  invoke('audio_set_media_position', { position: getCurrentTime() }).catch(console.error);
}

// Listen for media control events from souvlaki (MPRIS/SMTC)
listen('media:play', () => usePlayerStore.getState().resume());
listen('media:pause', () => usePlayerStore.getState().pause());
listen('media:toggle', () => usePlayerStore.getState().togglePlay());
listen('media:next', () => usePlayerStore.getState().next());
listen('media:prev', () => handlePrev());
listen<number>('media:seek', (e) => seek(e.payload));
listen<number>('media:seek-relative', (e) => {
  const offset = e.payload;
  if (offset > 0) {
    seek(Math.min(getCurrentTime() + offset, getDuration()));
  } else {
    seek(Math.max(getCurrentTime() + offset, 0));
  }
});

/* ── Preloading ──────────────────────────────────────────────── */

let preloadTimer: ReturnType<typeof setTimeout> | null = null;

export function preloadTrack(track: Track) {
  const urn = track.urn;
  cancelPreload();
  if (!isHoverPreloadEnabled() || isLocalUrn(urn)) return;
  preloadTimer = setTimeout(() => {
    const sessionId = getSessionId();
    const hq = isHqStreaming();
    invoke('track_preload', {
      entries: [
        {
          urn,
          urls: streamFallbackUrls(urn, hq),
          downloadUrls: downloadFallbackUrls(urn, hq),
          storageUrls: buildStorageUrls(urn),
          sessionId,
          hq,
          durationMs: expectedDurationMs(track),
          storageQuality: track._scd_meta?.storage_quality,
        },
      ],
    }).catch(console.error);
  }, 800);
}

export function cancelPreload() {
  if (preloadTimer) clearTimeout(preloadTimer);
  preloadTimer = null;
}

export function preloadQueue() {
  if (isAudioCacheDisabled()) return;
  const { queue, queueIndex } = usePlayerStore.getState();
  const entries: Array<{
    urn: string;
    urls: string[];
    downloadUrls: string[];
    storageUrls: string[];
    sessionId: string | null;
    hq: boolean;
    durationMs?: number;
    storageQuality?: TrackScdMeta['storage_quality'];
  }> = [];
  const sessionId = getSessionId();
  const hq = isHqStreaming();

  for (let i = 1; i <= 3; i++) {
    const idx = queueIndex + i;
    if (idx < queue.length && !isLocalUrn(queue[idx].urn)) {
      entries.push({
        urn: queue[idx].urn,
        urls: streamFallbackUrls(queue[idx].urn, hq),
        downloadUrls: downloadFallbackUrls(queue[idx].urn, hq),
        storageUrls: buildStorageUrls(queue[idx].urn),
        sessionId,
        hq,
        durationMs: expectedDurationMs(queue[idx]),
        storageQuality: queue[idx]._scd_meta?.storage_quality,
      });
    }
  }

  if (entries.length > 0) {
    invoke('track_preload', { entries }).catch(console.error);
  }
}

usePlayerStore.subscribe((state, prev) => {
  if (!hasTrack) return;
  if (state.queueIndex !== prev.queueIndex || state.queue !== prev.queue) {
    preloadQueue();
  }
});
