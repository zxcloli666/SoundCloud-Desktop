import { Injectable } from '@nestjs/common';
import { SoundcloudService } from '../soundcloud/soundcloud.service.js';
import {
  ScPaginatedResponse,
  ScPlaylist,
  ScTrack,
  ScUser,
  ScWebProfile,
} from '../soundcloud/soundcloud.types.js';

@Injectable()
export class UsersService {
  constructor(private readonly sc: SoundcloudService) {}

  search(token: string, params?: Record<string, unknown>): Promise<ScPaginatedResponse<ScUser>> {
    return this.sc.apiGet('/users', token, params);
  }

  getById(token: string, userUrn: string): Promise<ScUser> {
    return this.sc.apiGet(`/users/${userUrn}`, token);
  }

  getFollowers(
    token: string,
    userUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScUser>> {
    return this.sc.apiGet(`/users/${userUrn}/followers`, token, params);
  }

  getFollowings(
    token: string,
    userUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScUser>> {
    return this.sc.apiGet(`/users/${userUrn}/followings`, token, params);
  }

  async getIsFollowing(token: string, userUrn: string, followingUrn: string): Promise<boolean> {
    try {
      const response = (await this.sc.apiGet(
        `/users/${userUrn}/followings/${followingUrn}`,
        token,
      )) as { urn?: string } | null;

      return response?.urn === followingUrn;
    } catch {
      return false;
    }
  }

  getTracks(
    token: string,
    userUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    return this.sc.apiGet(`/users/${userUrn}/tracks`, token, params);
  }

  getPlaylists(
    token: string,
    userUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScPlaylist>> {
    return this.sc.apiGet(`/users/${userUrn}/playlists`, token, params);
  }

  getLikedTracks(
    token: string,
    userUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    return this.sc.apiGet(`/users/${userUrn}/likes/tracks`, token, params);
  }

  getLikedPlaylists(
    token: string,
    userUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScPlaylist>> {
    return this.sc.apiGet(`/users/${userUrn}/likes/playlists`, token, params);
  }

  getWebProfiles(
    token: string,
    userUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScWebProfile[]> {
    return this.sc.apiGet(`/users/${userUrn}/web-profiles`, token, params);
  }
}
