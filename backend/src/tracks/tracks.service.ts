import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { SoundcloudService } from '../soundcloud/soundcloud.service.js';
import {
  ScComment,
  ScPaginatedResponse,
  ScStreams,
  ScTrack,
  ScUser,
} from '../soundcloud/soundcloud.types.js';

@Injectable()
export class TracksService {
  constructor(private readonly sc: SoundcloudService) {}

  search(token: string, params?: Record<string, unknown>): Promise<ScPaginatedResponse<ScTrack>> {
    return this.sc.apiGet('/tracks', token, params);
  }

  getById(token: string, trackUrn: string, params?: Record<string, unknown>): Promise<ScTrack> {
    return this.sc.apiGet(`/tracks/${trackUrn}`, token, params);
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

  getRelated(
    token: string,
    trackUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    return this.sc.apiGet(`/tracks/${trackUrn}/related`, token, params);
  }
}
