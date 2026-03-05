import { Injectable } from '@nestjs/common';
import { SoundcloudService } from '../soundcloud/soundcloud.service.js';
import {
  ScActivity,
  ScMe,
  ScPaginatedResponse,
  ScPlaylist,
  ScTrack,
  ScUser,
} from '../soundcloud/soundcloud.types.js';

@Injectable()
export class MeService {
  constructor(private readonly sc: SoundcloudService) {}

  getProfile(token: string): Promise<ScMe> {
    return this.sc.apiGet<ScMe>('/me', token);
  }

  getFeed(
    token: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScActivity>> {
    return this.sc.apiGet('/me/feed', token, params);
  }

  getFeedTracks(
    token: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScActivity>> {
    return this.sc.apiGet('/me/feed/tracks', token, params);
  }

  getLikedTracks(
    token: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    return this.sc.apiGet('/me/likes/tracks', token, params);
  }

  getLikedPlaylists(
    token: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScPlaylist>> {
    return this.sc.apiGet('/me/likes/playlists', token, params);
  }

  getFollowings(
    token: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScUser>> {
    return this.sc.apiGet('/me/followings', token, params);
  }

  getFollowingsTracks(
    token: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    return this.sc.apiGet('/me/followings/tracks', token, params);
  }

  followUser(token: string, userUrn: string): Promise<unknown> {
    return this.sc.apiPut(`/me/followings/${userUrn}`, token);
  }

  unfollowUser(token: string, userUrn: string): Promise<unknown> {
    return this.sc.apiDelete(`/me/followings/${userUrn}`, token);
  }

  getFollowers(
    token: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScUser>> {
    return this.sc.apiGet('/me/followers', token, params);
  }

  getPlaylists(
    token: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScPlaylist>> {
    return this.sc.apiGet('/me/playlists', token, params);
  }

  getTracks(
    token: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    return this.sc.apiGet('/me/tracks', token, params);
  }
}
