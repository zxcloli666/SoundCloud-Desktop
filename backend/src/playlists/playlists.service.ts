import { Injectable } from '@nestjs/common';
import { SoundcloudService } from '../soundcloud/soundcloud.service.js';
import {
  ScPaginatedResponse,
  ScPlaylist,
  ScTrack,
  ScUser,
} from '../soundcloud/soundcloud.types.js';

@Injectable()
export class PlaylistsService {
  constructor(private readonly sc: SoundcloudService) {}

  search(
    token: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScPlaylist>> {
    return this.sc.apiGet('/playlists', token, params);
  }

  create(token: string, body: unknown): Promise<ScPlaylist> {
    return this.sc.apiPost('/playlists', token, body);
  }

  getById(
    token: string,
    playlistUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPlaylist> {
    return this.sc.apiGet(`/playlists/${playlistUrn}`, token, params);
  }

  update(token: string, playlistUrn: string, body: unknown): Promise<ScPlaylist> {
    return this.sc.apiPut(`/playlists/${playlistUrn}`, token, body);
  }

  delete(token: string, playlistUrn: string): Promise<unknown> {
    return this.sc.apiDelete(`/playlists/${playlistUrn}`, token);
  }

  getTracks(
    token: string,
    playlistUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    return this.sc.apiGet(`/playlists/${playlistUrn}/tracks`, token, params);
  }

  getReposters(
    token: string,
    playlistUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScUser>> {
    return this.sc.apiGet(`/playlists/${playlistUrn}/reposters`, token, params);
  }
}
