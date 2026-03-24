import type { Readable } from 'node:stream';
import { Injectable, Logger } from '@nestjs/common';
import { LocalLikesService } from '../local-likes/local-likes.service.js';
import { ScPublicApiService } from '../soundcloud/sc-public-api.service.js';
import { SoundcloudService } from '../soundcloud/soundcloud.service.js';
import type {
  ScComment,
  ScPaginatedResponse,
  ScStreams,
  ScTrack,
  ScUser,
} from '../soundcloud/soundcloud.types.js';

@Injectable()
export class TracksService {
  private readonly logger = new Logger(TracksService.name);

  constructor(
    private readonly sc: SoundcloudService,
    private readonly scPublicApi: ScPublicApiService,
    private readonly localLikes: LocalLikesService,
  ) {}

  private async applyLocalLikeFlags(sessionId: string, tracks: ScTrack[]): Promise<ScTrack[]> {
    const urns = tracks.map((track) => track.urn).filter(Boolean);
    const likedUrns = await this.localLikes.getLikedTrackIds(sessionId, urns);
    if (likedUrns.size === 0) {
      return tracks;
    }

    return tracks.map((track) =>
      likedUrns.has(track.urn) ? { ...track, user_favorite: true } : track,
    );
  }

  async search(
    token: string,
    sessionId: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    const response = await this.sc.apiGet<ScPaginatedResponse<ScTrack>>('/tracks', token, params);
    response.collection = await this.applyLocalLikeFlags(sessionId, response.collection ?? []);
    return response;
  }

  async getById(
    token: string,
    sessionId: string,
    trackUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScTrack> {
    const track = await this.sc.apiGet<ScTrack>(`/tracks/${trackUrn}`, token, params);
    const [annotated] = await this.applyLocalLikeFlags(sessionId, [track]);
    return annotated;
  }

  update(token: string, trackUrn: string, body: unknown): Promise<ScTrack> {
    return this.sc.apiPut(`/tracks/${trackUrn}`, token, body);
  }

  delete(token: string, trackUrn: string): Promise<unknown> {
    return this.sc.apiDelete(`/tracks/${trackUrn}`, token);
  }

  getStreams(
    token: string,
    trackUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScStreams> {
    return this.sc.apiGet(`/tracks/${trackUrn}/streams`, token, params);
  }

  proxyStream(
    token: string,
    url: string,
    range?: string,
  ): Promise<{ stream: Readable; headers: Record<string, string> }> {
    return this.sc.proxyStream(url, token, range);
  }

  async tryOAuthStream(
    token: string,
    trackUrn: string,
    format: string,
    params: Record<string, unknown>,
    range?: string,
  ): Promise<{ stream: Readable; headers: Record<string, string> } | null> {
    try {
      const streams = await this.getStreams(token, trackUrn, params);
      const urlKey = `${format}_url` as keyof typeof streams;

      const fallbackOrder: (keyof ScStreams)[] = [
        'hls_aac_160_url',
        'http_mp3_128_url',
        'hls_mp3_128_url',
      ];

      // Build ordered list: requested format first, then fallbacks
      const candidates: { key: keyof ScStreams; url: string }[] = [];
      const requestedUrl = streams[urlKey] as string | undefined;
      if (requestedUrl) {
        candidates.push({ key: urlKey as keyof ScStreams, url: requestedUrl });
      }
      for (const key of fallbackOrder) {
        if (streams[key] && key !== urlKey) {
          candidates.push({ key, url: streams[key] as string });
        }
      }

      if (!candidates.length) return null;

      for (const { key, url } of candidates) {
        const fmt = (key as string).replace('_url', '');
        const isHls = fmt.startsWith('hls_');

        try {
          if (isHls) {
            return await this.scPublicApi.streamFromHls(url, this.hlsMimeType(fmt));
          }
          return await this.proxyStream(token, url, range);
        } catch (err: any) {
          this.logger.warn(`Stream format ${fmt} failed: ${err.message}, trying next...`);
          continue;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private hlsMimeType(format: string): string {
    if (format.includes('aac')) return 'audio/mp4; codecs="mp4a.40.2"';
    if (format.includes('opus')) return 'audio/ogg; codecs="opus"';
    return 'audio/mpeg';
  }

  /**
   * Fallback: resolve stream via SoundCloud public API (no OAuth).
   * Used when the authenticated /streams endpoint fails or returns empty.
   */
  async getPublicStream(
    trackUrn: string,
    format?: string,
  ): Promise<{ stream: Readable; headers: Record<string, string> } | null> {
    try {
      return await this.scPublicApi.getStreamForTrack(trackUrn, format);
    } catch (err: any) {
      this.logger.warn(`Public API fallback failed for ${trackUrn}: ${err.message}`);
      return null;
    }
  }

  getComments(
    token: string,
    trackUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScComment>> {
    return this.sc.apiGet(`/tracks/${trackUrn}/comments`, token, params);
  }

  createComment(
    token: string,
    trackUrn: string,
    body: { comment: { body: string; timestamp?: number } },
  ): Promise<ScComment> {
    return this.sc.apiPost(`/tracks/${trackUrn}/comments`, token, body);
  }

  getFavoriters(
    token: string,
    trackUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScUser>> {
    return this.sc.apiGet(`/tracks/${trackUrn}/favoriters`, token, params);
  }

  getReposters(
    token: string,
    trackUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScUser>> {
    return this.sc.apiGet(`/tracks/${trackUrn}/reposters`, token, params);
  }

  async getRelated(
    token: string,
    sessionId: string,
    trackUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    const response = await this.sc.apiGet<ScPaginatedResponse<ScTrack>>(
      `/tracks/${trackUrn}/related`,
      token,
      params,
    );
    response.collection = await this.applyLocalLikeFlags(sessionId, response.collection ?? []);
    return response;
  }
}
