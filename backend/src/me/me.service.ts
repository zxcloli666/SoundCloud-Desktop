import { Injectable } from '@nestjs/common';
import { LocalLikesService } from '../local-likes/local-likes.service.js';
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
  constructor(
    private readonly sc: SoundcloudService,
    private readonly localLikes: LocalLikesService,
  ) {}

  getProfile(token: string): Promise<ScMe> {
    return this.sc.apiGet<ScMe>('/me', token);
  }

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

  private async applyLocalLikeFlagsToActivities(
    sessionId: string,
    activities: ScActivity[],
  ): Promise<ScActivity[]> {
    const trackOrigins = activities
      .map((activity) => activity.origin)
      .filter((origin): origin is ScTrack => origin?.kind === 'track');

    const annotatedTracks = await this.applyLocalLikeFlags(sessionId, trackOrigins);
    const byUrn = new Map(annotatedTracks.map((track) => [track.urn, track]));

    return activities.map((activity) => {
      if (activity.origin?.kind !== 'track') {
        return activity;
      }
      return {
        ...activity,
        origin: byUrn.get(activity.origin.urn) ?? activity.origin,
      };
    });
  }

  async getFeed(
    token: string,
    sessionId: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScActivity>> {
    const response = await this.sc.apiGet<ScPaginatedResponse<ScActivity>>(
      '/me/feed',
      token,
      params,
    );
    response.collection = await this.applyLocalLikeFlagsToActivities(
      sessionId,
      response.collection ?? [],
    );
    return response;
  }

  async getFeedTracks(
    token: string,
    sessionId: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScActivity>> {
    const response = await this.sc.apiGet<ScPaginatedResponse<ScActivity>>(
      '/me/feed/tracks',
      token,
      params,
    );
    response.collection = await this.applyLocalLikeFlagsToActivities(
      sessionId,
      response.collection ?? [],
    );
    return response;
  }

  async getLikedTracks(
    token: string,
    sessionId: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    const scResult = await this.sc.apiGet<ScPaginatedResponse<ScTrack>>(
      '/me/likes/tracks',
      token,
      params,
    );

    // On the first page (no cursor/offset), prepend local likes
    const hasCursor = params && (params.cursor || params.offset);
    if (!hasCursor) {
      const localResult = await this.localLikes.findAll(sessionId, 200);
      if (localResult.collection.length > 0) {
        const scUrns = new Set(scResult.collection.map((t) => t.urn));
        const localTracks = localResult.collection
          .map((data) => data as unknown as ScTrack)
          .filter((t) => t.urn && !scUrns.has(t.urn));
        if (localTracks.length > 0) {
          scResult.collection = [...localTracks, ...scResult.collection];
        }
      }
    }

    return scResult;
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

  async getFollowingsTracks(
    token: string,
    sessionId: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    const response = await this.sc.apiGet<ScPaginatedResponse<ScTrack>>(
      '/me/followings/tracks',
      token,
      params,
    );
    response.collection = await this.applyLocalLikeFlags(sessionId, response.collection ?? []);
    return response;
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

  async getTracks(
    token: string,
    sessionId: string,
    params?: Record<string, unknown>,
  ): Promise<ScPaginatedResponse<ScTrack>> {
    const response = await this.sc.apiGet<ScPaginatedResponse<ScTrack>>(
      '/me/tracks',
      token,
      params,
    );
    response.collection = await this.applyLocalLikeFlags(sessionId, response.collection ?? []);
    return response;
  }
}
