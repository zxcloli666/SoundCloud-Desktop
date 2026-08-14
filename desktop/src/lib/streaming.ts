import type { Track } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { ApiError, getSessionId } from './api-client';
import { STORAGE_BASE, STREAMING_BASE } from './constants';
import { logHttpError, logHttpFailure, trackAsync } from './diagnostics';
import { edgeFetch } from './edge';
import { markHealthy, markUnhealthy } from './host-status';

// ─── Types ──────────────────────────────────────────────────

export type ResolvedStreamingTrack = Partial<Track> & {
  full_duration?: number;
  /// SC resolve отдаёт любую сущность: track / user / playlist (включая альбомы).
  kind?: string;
};

// ─── Host resolution ────────────────────────────────────────

function resolveStreamingBases(): string[] {
  return [STREAMING_BASE];
}

// ─── Streaming JSON ─────────────────────────────────────────

async function streamingJson<T = unknown>(path: string): Promise<T> {
  let lastError: unknown = null;

  const label = `GET ${path}`;

  for (const base of resolveStreamingBases()) {
    const url = `${base}${path}`;
    try {
      const res = await trackAsync(`streaming:${label}`, edgeFetch(url));

      if (!res.ok) {
        const body = await res.text();
        logHttpError(`streaming:${label}`, res.status, url, body);
        markUnhealthy(base);
        lastError = new ApiError(res.status, body);
        continue;
      }

      markHealthy(base);

      const contentType = res.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error(`Unexpected content-type: ${contentType ?? 'unknown'}`);
      }

      return res.json();
    } catch (error) {
      if (error instanceof ApiError) {
        lastError = error;
        continue;
      }
      logHttpFailure(`streaming:${label}`, url, error);
      markUnhealthy(base);
      lastError = error;
    }
  }

  throw lastError ?? new Error('Streaming request failed');
}

// ─── Public API ─────────────────────────────────────────────

export function resolveTrackFromStreaming(url: string) {
  return streamingJson<ResolvedStreamingTrack>(`/resolve?url=${encodeURIComponent(url)}`);
}

function buildStreamUrl(base: string, trackUrn: string, hq: boolean) {
  const params = new URLSearchParams();
  if (hq) params.set('hq', 'true');
  const sid = getSessionId();
  if (sid) params.set('session_id', sid);
  return `${base}/stream/${encodeURIComponent(trackUrn)}?${params.toString()}`;
}

/** Direct storage URL used before the streaming fallback. */
export function buildStorageUrls(trackUrn: string): string[] {
  const file = `${trackUrn.replace(/:/g, '_')}.m4a`;
  return [`${STORAGE_BASE}/${file}`];
}

export function streamFallbackUrls(
  trackUrn: string,
  hq = useSettingsStore.getState().highQualityStreaming,
): string[] {
  const bases = resolveStreamingBases();
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const base of bases) {
    const url = buildStreamUrl(base, trackUrn, hq);
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

function buildDownloadUrl(base: string, trackUrn: string, hq: boolean) {
  const params = new URLSearchParams();
  if (hq) params.set('hq', 'true');
  const sid = getSessionId();
  if (sid) params.set('session_id', sid);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  return `${base}/download/${encodeURIComponent(trackUrn)}${suffix}`;
}

/// URL'ы `/download/:urn` по всем валидным стриминг-базам.
/// Клиент дергает их между anon и storage stream: сервер только резолвит
/// прямые SoundCloud-ссылки; progressive/HLS скачиваются напрямую с SC.
export function downloadFallbackUrls(
  trackUrn: string,
  hq = useSettingsStore.getState().highQualityStreaming,
): string[] {
  const bases = resolveStreamingBases();
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const base of bases) {
    const url = buildDownloadUrl(base, trackUrn, hq);
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}
