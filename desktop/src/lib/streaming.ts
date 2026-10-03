import type { Track } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { ApiError, getSessionId } from './api-client';
import {
  API_BASE,
  API_STAR_BASE,
  STORAGE_BASE,
  STORAGE_PREMIUM_BASE,
  STREAMING_BASE,
  STREAMING_PREMIUM_BASE,
} from './constants';
import { logHttpError, logHttpFailure, trackAsync } from './diagnostics';
import { edgeFetch } from './edge';
import { markHealthy, markUnhealthy } from './host-status';
// Прямо из premium-cache, а не из subscription: тот тянет api-client и
// query-client, и импорт отсюда замкнул бы цикл (см. шапку premium-cache).
import { getIsPremium } from './premium-cache';

// ─── Types ──────────────────────────────────────────────────

export type ResolvedStreamingTrack = Partial<Track> & {
  full_duration?: number;
  /// SC resolve отдаёт любую сущность: track / user / playlist (включая альбомы).
  kind?: string;
};

// ─── Host resolution ────────────────────────────────────────

function resolveStreamingBases(): string[] {
  return [...new Set([STREAMING_PREMIUM_BASE, STREAMING_BASE])];
}

function resolveDownloadBases(): string[] {
  const bases = getIsPremium() ? [STREAMING_PREMIUM_BASE, STREAMING_BASE] : [STREAMING_BASE];
  return [...new Set(bases)];
}

function resolveTicketBases(): string[] {
  const bases = getIsPremium() ? [API_STAR_BASE, API_BASE] : [API_BASE];
  return [...new Set(bases)];
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
  const suffix = hq ? '?hq=true' : '';
  return `${base}/tracks/${encodeURIComponent(trackUrn)}/stream${suffix}`;
}

/**
 * Точки отдачи медиа, приоритетная первой. Премиум забирает байты с резервной
 * (S3 read-only на star-host), не гоняя за каждым файлом на main; ядро само
 * упорядочит список по здоровью хостов и переберёт до первого ответа.
 *
 * Не-премиуму star отдаёт 403 (`PREMIUM_ONLY`), так что второй адрес ему только
 * стоил бы лишнего запроса — у него список из одного main.
 */
export function buildStorageUrls(trackUrn: string): string[] {
  const file = `${trackUrn.replace(/:/g, '_')}.m4a`;
  const bases = getIsPremium() ? [STORAGE_PREMIUM_BASE, STORAGE_BASE] : [STORAGE_BASE];
  return [...new Set(bases)].map((base) => `${base}/${file}`);
}

export function streamFallbackUrls(
  trackUrn: string,
  hq = useSettingsStore.getState().highQualityStreaming,
): string[] {
  const bases = resolveTicketBases();
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
/// SoundCloud-ссылки + (для encrypted) делает Widevine handshake, скачивание
/// сегментов идёт прямо с SC.
export function downloadFallbackUrls(
  trackUrn: string,
  hq = useSettingsStore.getState().highQualityStreaming,
): string[] {
  const bases = resolveDownloadBases();
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
