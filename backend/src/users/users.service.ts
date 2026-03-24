import { Injectable } from '@nestjs/common';
import { LocalLikesService } from '../local-likes/local-likes.service.js';
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
  constructor(
    private readonly sc: SoundcloudService,
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

  async getTracks(
    token: string,
    sessionId: string,
    userUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    const response = await this.sc.apiGet<ScPaginatedResponse<ScTrack>>(
      `/users/${userUrn}/tracks`,
      token,
      params,
    );
    response.collection = await this.applyLocalLikeFlags(sessionId, response.collection ?? []);
    return response;
  }

  getPlaylists(
    token: string,
    userUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScPlaylist>> {
    return this.sc.apiGet(`/users/${userUrn}/playlists`, token, params);
  }

  async getLikedTracks(
    token: string,
    sessionId: string,
    userUrn: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    const response = await this.sc.apiGet<ScPaginatedResponse<ScTrack>>(
      `/users/${userUrn}/likes/tracks`,
      token,
      params,
    );
    response.collection = await this.applyLocalLikeFlags(sessionId, response.collection ?? []);
    return response;
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
