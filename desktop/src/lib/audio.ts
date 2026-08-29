import { listen } from '@tauri-apps/api/event';
import { toast } from 'sonner';
import i18n from '../i18n';
import type { Track } from '../stores/player';
import { usePlayerStore } from '../stores/player';
import { recordLocalPlayStart } from '../stores/recommendation-taste';
import { useSettingsStore } from '../stores/settings';
import {
  api,
  buildStorageUrls,
  downloadFallbackUrls,
  getSessionId,
  resolveTrackFromStreaming,
  streamFallbackUrls,
} from './api';
import { createAudioCommandSync } from './audio-command-sync';
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
import { clearUrnCluster, recordClusterFeedback, takeUrnCluster } from './recsFeedback';
import { withTimeout } from './request-timeout';
import { getArtistDisplay, getDisplayTitle } from './track-display';

const SKIP_THRESHOLD_SEC = 30;
const MIN_ACTUAL_PLAYBACK_FOR_SKIP_SEC = 1;
const MAX_CONTIGUOUS_TASTE_TICK_SEC = 3;
/** Минимум, чтобы засчитать «прослушано полностью» для коротких треков (50% длительности). */
const FULL_PLAY_RATIO = 0.5;
/** Битый кеш: сыграло меньше этого на треке от EARLY_END_MIN_EXPECTED_SEC — лечим перекачкой. */
const EARLY_END_PLAYED_SEC = 10;
const EARLY_END_MIN_EXPECTED_SEC = 30;
const HEALED_URN_HISTORY_CAP = 256;
/** Один лечебный перекач на урн за сессию — защита от лупа на 30s-превью и мёртвых источниках. */
const healedUrns = new Set<string>();
const TRACK_START_BUDGET_MS = 18_000;
const MAX_STREAM_ERROR_RETRIES = 1;

export type TrackLoadStage =
  | 'idle'
  | 'checkingCache'
  | 'resolving'
  | 'buffering'
  | 'retrying'
  | 'ready'
  | 'failed';

/* ── Audio engine state ──────────────────────────────────────── */

let currentUrn: string | null = null;
let hasTrack = false;
let fallbackDuration = 0;
let cachedTime = 0;
let cachedDuration = 0;
let downloadProgress: number | null = null;
let loadStage: TrackLoadStage = 'idle';
let loadGen = 0;
let activeLoad: { gen: number; urn: string } | null = null;
let seekGen = 0;
let lastEndedUrn: string | null = null;
let metadataAbort: AbortController | null = null;
let streamRetryUrn: string | null = null;
let streamRetryCount = 0;
let tasteTrackingUrn: string | null = null;
let tastePlayedSeconds = 0;
let tasteLastPosition: number | null = null;
let qualifiedPlayRecorded = false;
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

export function getLoadStage(): TrackLoadStage {
  return loadStage;
}

function setLoadStage(value: TrackLoadStage): void {
  if (loadStage === value) return;
  loadStage = value;
  notify();
}

function setDownloadProgress(value: number | null): void {
  if (downloadProgress === value) return;
  downloadProgress = value;
  notify();
}

export function seek(seconds: number) {
  if (!hasTrack) return;
  const position = Math.max(0, Math.min(seconds, cachedDuration || fallbackDuration || seconds));
  const gen = ++seekGen;
  cachedTime = position;
  if (tasteTrackingUrn === currentUrn) tasteLastPosition = position;
  notify();
  void invoke('audio_seek', { position })
    .then(() => {
      if (gen === seekGen) updateMediaPosition();
    })
    .catch((error) => {
      console.warn('[Audio] seek rejected:', error);
      if (gen !== seekGen) return;
      void invoke<number>('audio_get_position')
        .then((actualPosition) => {
          if (gen !== seekGen) return;
          cachedTime = actualPosition;
          notify();
          updateMediaPosition();
        })
        .catch(console.error);
    });
}

function resetTastePlaybackTracking(urn: string | null): void {
  tasteTrackingUrn = urn;
  tastePlayedSeconds = 0;
  tasteLastPosition = urn ? 0 : null;
  qualifiedPlayRecorded = false;
}

function qualifiedPlayThreshold(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 5;
  return Math.min(5, Math.max(1, durationSeconds * 0.25));
}

function recordQualifiedPlay(track: Track): void {
  if (qualifiedPlayRecorded || !track.urn || !track.title) return;
  qualifiedPlayRecorded = true;
  recordLocalPlayStart(track);

  if (!SEND_BEHAVIORAL_DATA) return;
  api('/history', {
    method: 'POST',
    body: JSON.stringify({
      scTrackId: track.urn,
      title: getDisplayTitle(track),
      artistName: getArtistDisplay(track).primary || track.user?.username || '',
      artistUrn: track.user?.urn || null,
      artworkUrl: track.artwork_url || null,
      duration: track.duration || 0,
    }),
  }).catch(() => {});
}

function noteActualPlayback(position: number): void {
  const state = usePlayerStore.getState();
  const track = state.currentTrack;
  if (!currentUrn || !hasTrack || !track || track.urn !== currentUrn) {
    tasteLastPosition = Number.isFinite(position) ? position : null;
    return;
  }
  if (tasteTrackingUrn !== currentUrn) resetTastePlaybackTracking(currentUrn);

  const previousPosition = tasteLastPosition;
  tasteLastPosition = position;
  if (state.isPlaying && previousPosition != null) {
    const delta = position - previousPosition;
    // Large jumps are seeks or stale native ticks, never actual listening time.
    if (delta > 0 && delta <= MAX_CONTIGUOUS_TASTE_TICK_SEC) {
      tastePlayedSeconds += delta;
    }
  }

  const duration = cachedDuration > 0 ? cachedDuration : fallbackDuration;
  if (tastePlayedSeconds >= qualifiedPlayThreshold(duration)) recordQualifiedPlay(track);
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
  seekGen += 1;
  hasTrack = false;
  cachedTime = 0;
  setLoadStage('idle');
  await invoke('audio_stop').catch(console.error);
}

function withTrackStartDeadline<T>(
  operation: Promise<T>,
  deadline: number,
  gen: number,
  urn: string,
): Promise<T> {
  const remainingMs = Math.max(1, deadline - performance.now());
  return withTimeout(operation, remainingMs, 'track start', () => {
    if (gen === loadGen && currentUrn === urn) {
      void invoke('audio_stop').catch(console.error);
    }
  });
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
  const pos = cachedTime;
  const loadPromise = loadTrack(track);
  const gen = loadGen;
  await loadPromise;
  if (isCurrentLoad(gen, track.urn) && pos > 0) seek(pos);
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
  isCurrent: () => boolean,
): Promise<{ duration_secs: number | null }> {
  try {
    return await invoke<{ duration_secs: number | null }>('audio_load_file', {
      path,
      cacheKey: urn,
      startPaused,
    });
  } catch (e) {
    if (!isFileMissing(e)) throw e;
    if (!isCurrent()) throw e;
    console.warn('[Audio] cached file vanished, re-resolving:', urn);
    const fresh = await reResolve();
    if (!fresh || !isCurrent()) throw e;
    return await invoke<{ duration_secs: number | null }>('audio_load_file', {
      path: fresh,
      cacheKey: urn,
      startPaused,
    });
  }
}

function loadTrack(track: Track, options: { preserveStreamRetry?: boolean } = {}): Promise<void> {
  const promise = runTrackLoad(track, options);
  const attempt = { gen: loadGen, urn: track.urn };
  activeLoad = attempt;
  return promise.finally(() => {
    if (activeLoad === attempt) activeLoad = null;
  });
}

function isCurrentLoad(gen: number, urn: string): boolean {
  return gen === loadGen && currentUrn === urn;
}

async function runTrackLoad(track: Track, options: { preserveStreamRetry?: boolean } = {}) {
  if (!options.preserveStreamRetry || streamRetryUrn !== track.urn) {
    streamRetryUrn = track.urn;
    streamRetryCount = 0;
  }
  const gen = ++loadGen;
  const previousUrn = currentUrn;
  const isNewTrack = previousUrn !== track.urn;
  let metadataController: AbortController | null = null;
  if (isNewTrack) {
    metadataAbort?.abort();
    metadataController = new AbortController();
    metadataAbort = metadataController;
  }
  if (previousUrn && previousUrn !== track.urn) {
    void cancelTrackDownload(previousUrn).catch(console.error);
  }
  if (isNewTrack) resetTastePlaybackTracking(track.urn);
  currentUrn = track.urn;
  cancelPendingPreload();
  await stopTrack();
  if (!isCurrentLoad(gen, track.urn)) return;
  const urn = track.urn;
  const startDeadline = performance.now() + TRACK_START_BUDGET_MS;

  // A-B loop is per-track: drop it only when loading a genuinely different track —
  // NOT on same-track reloads (repeat-one, device/EQ reload, or the loop's own
  // restart). Done here, after currentUrn is advanced, so the resulting store
  // notification doesn't re-enter the track-changed branch of the subscriber.
  if (isNewTrack && usePlayerStore.getState().abLoop) {
    usePlayerStore.getState().clearAbLoop();
  }

  if (metadataController) {
    void hydrateTrackMetadata(track, metadataController);
  }

  fallbackDuration = track.duration / 1000;
  cachedDuration = fallbackDuration;
  cachedTime = 0;
  setDownloadProgress(null);
  usePlayerStore.getState().setPlaybackTransport(null, null);
  notify();

  // Apply control state before the decoder/player reads it. The sync layer deduplicates
  // values already present in Rust, so steady-state track changes do not add IPC work.
  await Promise.all([
    eqCommandSync.syncNow(),
    normalizationCommandSync.syncNow(),
    volumeCommandSync.syncNow(),
    rateCommandSync.syncNow(),
  ]);
  if (!isCurrentLoad(gen, urn)) return;

  try {
    const highQualityStreaming = useSettingsStore.getState().highQualityStreaming;
    setLoadStage('checkingCache');

    // The cached file can be swapped (raw А → clean Б) or evicted between resolve
    // and read; re-resolve through the cache to recover the current path.
    const reResolve = async (): Promise<string | null> => {
      const info = await getCacheInfo(urn);
      if (!isCurrentLoad(gen, urn)) return null;
      if (info?.path) return info.path;
      try {
        const ensured = await ensureTrackCached(urn, highQualityStreaming, track.duration);
        return isCurrentLoad(gen, urn) ? ensured.path : null;
      } catch {
        return null;
      }
    };

    // Strategy 1: Cache hit — instant
    const cached = await getCacheInfo(urn);
    if (!isCurrentLoad(gen, urn)) return;
    if (cached?.path) {
      usePlayerStore.getState().setPlaybackTransport(cached.quality, cached.source);
      console.log('[Audio] Playing from cache:', urn);
      const startPaused = !usePlayerStore.getState().isPlaying;
      const loadResult = await loadCachedFile(urn, cached.path, startPaused, reResolve, () =>
        isCurrentLoad(gen, urn),
      );
      if (!isCurrentLoad(gen, urn)) return;
      if (loadResult?.duration_secs) {
        fallbackDuration = loadResult.duration_secs;
        cachedDuration = loadResult.duration_secs;
        updateMetadata(track, loadResult.duration_secs);
        notify();
      }
      afterLoad(gen, urn, startPaused);
      setLoadStage('ready');
      return;
    }

    // Strategy 2: start from a small progressive/HLS buffer while Rust keeps
    // receiving the track and commits the same bytes to the regular cache.
    setDownloadProgress(0);
    setLoadStage('resolving');

    try {
      await cancelTrackDownload(urn);
      if (!isCurrentLoad(gen, urn)) return;
      let installedStartPaused = false;
      const startFastStream = async (hq: boolean) => {
        const request = await buildTrackRequest(urn, hq, track.duration);
        if (!isCurrentLoad(gen, urn)) throw new Error('load cancelled');
        setLoadStage('buffering');
        const startPaused = !usePlayerStore.getState().isPlaying;
        const result = await withTrackStartDeadline(
          invoke<{
            duration_secs: number | null;
            quality: 'hq' | 'sq';
            source: 'direct' | 'api';
          }>('audio_load_streaming', {
            request,
            startPaused,
          }),
          startDeadline,
          gen,
          urn,
        );
        installedStartPaused = startPaused;
        return result;
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
        if (!isCurrentLoad(gen, urn)) return;
        setLoadStage('retrying');
        streamed = await startFastStream(false);
      }
      if (!isCurrentLoad(gen, urn)) return;
      setDownloadProgress(null);
      usePlayerStore.getState().setPlaybackTransport(streamed.quality, streamed.source);
      console.log('[Audio] Fast stream started:', urn);
      afterLoad(gen, urn, installedStartPaused);
      setLoadStage('ready');
      return;
    } catch (error) {
      if (!isCurrentLoad(gen, urn)) return;
      throw error;
    }
  } catch (e) {
    if (!isCurrentLoad(gen, track.urn)) return;
    console.error('[Audio] Load failed:', e);
    setDownloadProgress(null);
    usePlayerStore.getState().setPlaybackTransport(null, null);
    setLoadStage('failed');
    const rawErrorText = getLoadErrorText(e);
    const errorText = rawErrorText?.toLowerCase().includes('track start timed out')
      ? i18n.t('track.loadTimeout')
      : rawErrorText;
    toast.error(i18n.t('track.loadError'), {
      description: errorText ? `${track.title}: ${errorText}` : track.title,
    });
    usePlayerStore.getState().pause();
  }
}

function afterLoad(gen: number, urn: string, startPaused: boolean) {
  if (!isCurrentLoad(gen, urn)) return;
  hasTrack = true;

  const isPlaying = usePlayerStore.getState().isPlaying;
  if (isPlaying === startPaused) {
    invoke(isPlaying ? 'audio_play' : 'audio_pause').catch(console.error);
  }
  updatePlaybackState(isPlaying);
  updateMediaPosition();
  preloadQueue();
}

async function hydrateTrackMetadata(track: Track, controller: AbortController) {
  let nextTrack = await fetchFreshTrackMetadata(track, controller.signal);
  if (metadataAbort !== controller || currentUrn !== track.urn) return;

  nextTrack = await resolveTrackMetadata(nextTrack, controller.signal);
  if (metadataAbort !== controller || currentUrn !== track.urn) return;
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
  if (healedUrns.size > HEALED_URN_HISTORY_CAP) {
    const oldestUrn = healedUrns.values().next().value;
    if (typeof oldestUrn === 'string') healedUrns.delete(oldestUrn);
  }
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
  usePlayerStore.getState().next('ended');
}

/* ── Tauri event listeners ───────────────────────────────────── */

const hasTauriRuntime = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const listenNative: typeof listen = hasTauriRuntime ? listen : async () => () => {};

listenNative<number>('audio:tick', (event) => {
  if (!hasTrack) return;
  cachedTime = event.payload;
  if (cachedDuration <= 0) cachedDuration = fallbackDuration;
  noteActualPlayback(event.payload);
  notify();
});

listenNative<{ urn: string; progress: number }>('track:download-progress', (event) => {
  const { urn, progress } = event.payload;
  if (urn === currentUrn) {
    setDownloadProgress(progress >= 0.999 ? null : progress);
  }
});

listenNative('audio:ended', () => {
  if (!hasTrack) return;
  if (maybeHealEarlyEnd()) return;
  if (currentUrn) {
    // Засчитываем full_play только если трек реально игрался: либо ≥30s,
    // либо проиграно ≥50% длительности (для коротких треков). Иначе это
    // зависшая загрузка / зеро-длительность баг — не отправляем.
    const playedEnough =
      tastePlayedSeconds >= SKIP_THRESHOLD_SEC ||
      (cachedDuration > 0 && tastePlayedSeconds >= cachedDuration * FULL_PLAY_RATIO);
    const cluster = takeUrnCluster(currentUrn);
    if (playedEnough) {
      const positionPct = cachedDuration > 0 ? Math.min(1, cachedTime / cachedDuration) : undefined;
      recordEvent('full_play', currentUrn, positionPct, usePlayerStore.getState().currentTrack);
      if (cluster) recordClusterFeedback(cluster, 'complete');
    }
    lastEndedUrn = currentUrn;
  }
  hasTrack = false;
  handleTrackEnd();
});

listenNative<string>('audio:stream-error', (event) => {
  if (!hasTrack) return;
  const track = usePlayerStore.getState().currentTrack;
  const urn = currentUrn;
  if (!track || !urn || track.urn !== urn) return;

  const errorText = getLoadErrorText(event.payload) ?? 'stream interrupted';
  if (streamRetryUrn !== urn) {
    streamRetryUrn = urn;
    streamRetryCount = 0;
  }

  if (streamRetryCount < MAX_STREAM_ERROR_RETRIES) {
    streamRetryCount += 1;
    console.warn(
      `[Audio] stream failed; retrying current track (${streamRetryCount}/${MAX_STREAM_ERROR_RETRIES}):`,
      errorText,
    );
    setLoadStage('retrying');
    setDownloadProgress(null);
    void loadTrack(track, { preserveStreamRetry: true });
    return;
  }

  // A failed installed stream is not a natural end: never advance the queue.
  // Leave the same track selected so a manual Play starts a fresh bounded load.
  console.error('[Audio] stream retry exhausted:', errorText);
  hasTrack = false;
  setLoadStage('failed');
  setDownloadProgress(null);
  usePlayerStore.getState().setPlaybackTransport(null, null);
  void invoke('audio_stop').catch(console.error);
  toast.error(i18n.t('track.loadError'), {
    description: `${track.title}: ${errorText}`,
  });
  usePlayerStore.getState().pause();
});

listenNative('audio:device-reconnected', () => {
  console.log('[Audio] Device reconnected');
});

listenNative<string>('audio:default-device-changed', (event) => {
  console.log(`[Audio] Default output changed to '${event.payload}'`);
});

/* ── Store subscriber ────────────────────────────────────────── */

interface EqCommandState {
  enabled: boolean;
  gains: number[];
}

function equalEqState(left: EqCommandState, right: EqCommandState): boolean {
  return (
    left.enabled === right.enabled &&
    left.gains.length === right.gains.length &&
    left.gains.every((gain, index) => gain === right.gains[index])
  );
}

const volumeCommandSync = createAudioCommandSync({
  delayMs: 40,
  read: () => usePlayerStore.getState().volume,
  send: (volume) => invoke('audio_set_volume', { volume }),
  onError: console.error,
});

const rateCommandSync = createAudioCommandSync({
  delayMs: 40,
  read: getEffectivePlaybackRate,
  send: (rate) => invoke('audio_set_playback_rate', { rate }),
  onError: console.error,
});

const eqCommandSync = createAudioCommandSync<EqCommandState>({
  delayMs: 60,
  read: () => {
    const { eqEnabled, eqGains } = useSettingsStore.getState();
    return { enabled: eqEnabled, gains: [...eqGains] };
  },
  equals: equalEqState,
  send: ({ enabled, gains }) => invoke('audio_set_eq', { enabled, gains }),
  onError: console.error,
});

const normalizationCommandSync = createAudioCommandSync({
  delayMs: 0,
  read: () => useSettingsStore.getState().normalizeVolume,
  send: (enabled) => invoke('audio_set_normalization', { enabled }),
  onError: console.error,
});

usePlayerStore.subscribe((state, prev) => {
  const nextUrn = state.currentTrack?.urn ?? null;
  const trackChanged = nextUrn !== currentUrn;
  const playToggled = state.isPlaying !== prev.isPlaying;

  if (trackChanged) {
    const previousUrn = currentUrn;
    const previousTime = cachedTime;
    const previousHadTrack = hasTrack;
    const previousTastePlayedSeconds = tastePlayedSeconds;

    if (
      previousUrn &&
      previousHadTrack &&
      previousTastePlayedSeconds >= MIN_ACTUAL_PLAYBACK_FOR_SKIP_SEC &&
      previousUrn !== lastEndedUrn
    ) {
      const previousDuration = cachedDuration > 0 ? cachedDuration : fallbackDuration;
      const positionPct =
        previousDuration > 0 ? Math.min(1, previousTime / previousDuration) : undefined;
      recordEvent('skip', previousUrn, positionPct, prev.currentTrack);
    }
    if (previousUrn) clearUrnCluster(previousUrn);
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
        resetTastePlaybackTracking(null);
        usePlayerStore.getState().setPlaybackTransport(null, null);
        notify();
        usePlayerStore.getState().next('dislike');
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
      resetTastePlaybackTracking(null);
      usePlayerStore.getState().setPlaybackTransport(null, null);
      notify();
    }
    return;
  }

  if (playToggled && !trackChanged) {
    if (state.isPlaying) {
      if (!hasTrack && state.currentTrack) {
        if (activeLoad?.urn !== state.currentTrack.urn) {
          void loadTrack(state.currentTrack);
        }
      } else {
        invoke('audio_play').catch(console.error);
      }
    } else {
      invoke('audio_pause').catch(console.error);
    }
    updatePlaybackState(state.isPlaying);
  }

  if (state.volume !== prev.volume) {
    volumeCommandSync.schedule();
  }

  if (
    state.playbackRate !== prev.playbackRate ||
    state.pitchSemitones !== prev.pitchSemitones ||
    state.pitchControlMode !== prev.pitchControlMode
  ) {
    rateCommandSync.schedule();
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
    eqCommandSync.schedule();
  }

  if (state.normalizeVolume !== prev.normalizeVolume) {
    void normalizationCommandSync.syncNow();
    if (usePlayerStore.getState().currentTrack) {
      void reloadCurrentTrack();
    }
  }
});

/* ── Native Media Controls (souvlaki: MPRIS/SMTC) ───────────── */

let lastMetadataKey: string | null = null;
let metadataCommandGeneration = 0;
let lastPlaybackState: boolean | null = null;
let playbackStateCommandGeneration = 0;

function updateMetadata(track: Track, durationSecs?: number) {
  const coverUrl = art(track.artwork_url, 't500x500') || undefined;
  const display = getArtistDisplay(track);
  const title = getDisplayTitle(track);
  const metadata = {
    title,
    artist: display.primary || track.user.username,
    coverUrl: coverUrl || null,
    durationSecs: durationSecs ?? track.duration / 1000,
  };
  const key = JSON.stringify(metadata);
  if (key === lastMetadataKey) return;
  lastMetadataKey = key;
  const generation = ++metadataCommandGeneration;
  invoke('audio_set_metadata', metadata).catch((error) => {
    if (generation === metadataCommandGeneration) lastMetadataKey = null;
    console.error(error);
  });
}

function updatePlaybackState(playing: boolean) {
  if (playing === lastPlaybackState) return;
  lastPlaybackState = playing;
  const generation = ++playbackStateCommandGeneration;
  invoke('audio_set_playback_state', { playing }).catch((error) => {
    if (generation === playbackStateCommandGeneration) lastPlaybackState = null;
    console.error(error);
  });
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
const PRELOAD_DEDUPE_MS = 15_000;
const PRELOAD_HISTORY_CAP = 64;
const recentPreloads = new Map<string, number>();

interface PreloadRequestEntry {
  urn: string;
  urls: string[];
  downloadUrls: string[];
  storageUrls: string[];
  sessionId: string | null;
  hq: boolean;
  durationMs?: number;
}

function cancelPendingPreload(): void {
  if (!preloadTimer) return;
  clearTimeout(preloadTimer);
  preloadTimer = null;
}

function canPreload(urn: string, now = Date.now()): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  if (urn === currentUrn) return false;
  const last = recentPreloads.get(urn);
  return last == null || now - last >= PRELOAD_DEDUPE_MS;
}

function takeFreshPreload(entries: PreloadRequestEntry[]): PreloadRequestEntry[] {
  const now = Date.now();
  const fresh = entries.filter((entry) => {
    if (!canPreload(entry.urn, now)) return false;
    recentPreloads.set(entry.urn, now);
    return true;
  });

  if (recentPreloads.size > PRELOAD_HISTORY_CAP) {
    for (const [urn, timestamp] of recentPreloads) {
      if (now - timestamp >= PRELOAD_DEDUPE_MS) recentPreloads.delete(urn);
    }
    while (recentPreloads.size > PRELOAD_HISTORY_CAP) {
      const oldest = recentPreloads.keys().next().value;
      if (typeof oldest !== 'string') break;
      recentPreloads.delete(oldest);
    }
  }
  return fresh;
}

function dispatchPreload(entries: PreloadRequestEntry[]): void {
  const fresh = takeFreshPreload(entries);
  if (fresh.length === 0) return;
  invoke('track_preload', { entries: fresh }).catch((error) => {
    for (const entry of fresh) recentPreloads.delete(entry.urn);
    console.error(error);
  });
}

export function preloadTrack(urn: string) {
  cancelPendingPreload();
  if (!canPreload(urn)) return;
  preloadTimer = setTimeout(() => {
    const sessionId = getSessionId();
    const hq = useSettingsStore.getState().highQualityStreaming;
    preloadTimer = null;
    dispatchPreload([
      {
        urn,
        urls: streamFallbackUrls(urn, hq),
        downloadUrls: downloadFallbackUrls(urn, hq),
        storageUrls: buildStorageUrls(urn),
        sessionId,
        hq,
      },
    ]);
  }, 500);
}

export function preloadQueue() {
  const { queue, queueIndex } = usePlayerStore.getState();
  const track = queue[queueIndex + 1];
  if (!track || !canPreload(track.urn)) return;
  const sessionId = getSessionId();
  const hq = useSettingsStore.getState().highQualityStreaming;
  dispatchPreload([
    {
      urn: track.urn,
      urls: streamFallbackUrls(track.urn, hq),
      downloadUrls: downloadFallbackUrls(track.urn, hq),
      storageUrls: buildStorageUrls(track.urn),
      sessionId,
      hq,
      durationMs: track.duration,
    },
  ]);
}

usePlayerStore.subscribe((state, prev) => {
  const nextUrn = state.queue[state.queueIndex + 1]?.urn;
  const previousNextUrn = prev.queue[prev.queueIndex + 1]?.urn;
  if (nextUrn !== previousNextUrn) {
    preloadQueue();
  }
});

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    // Speculative work is suppressed while hidden; resume the one useful queue
    // preload when the player becomes interactive again.
    if (document.visibilityState === 'visible') preloadQueue();
    else cancelPendingPreload();
  });
}
