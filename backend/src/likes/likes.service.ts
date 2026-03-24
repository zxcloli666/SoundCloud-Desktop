import { Injectable } from '@nestjs/common';
import { LocalLikesService } from '../local-likes/local-likes.service.js';
import { SoundcloudService } from '../soundcloud/soundcloud.service.js';
import { ScPaginatedResponse, ScPlaylist, ScTrack } from '../soundcloud/soundcloud.types.js';

const LIKES_PLAYLIST_NAME = 'Лайки | SoundCloud Desktop';
const LIKE_RETRY_ATTEMPTS = 3;
const LIKE_RETRY_DELAY_MS = 500;
const PLAYLIST_CACHE_TTL_MS = 5 * 60 * 1000;
const PLAYLIST_TRACKS_CACHE_TTL_MS = 30 * 1000;

type PaginationParams = Record<string, string>;
type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

@Injectable()
export class LikesService {
  private readonly likesPlaylistCache = new Map<string, CacheEntry<ScPlaylist>>();
  private readonly playlistTracksCache = new Map<string, CacheEntry<string[]>>();
  private readonly syncLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly sc: SoundcloudService,
    private readonly localLikes: LocalLikesService,
  ) {}

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async retryLikeTrack(token: string, trackUrn: string): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= LIKE_RETRY_ATTEMPTS; attempt++) {
      try {
        return await this.sc.apiPost(`/likes/tracks/${trackUrn}`, token);
      } catch (error) {
        lastError = error;
        if (attempt < LIKE_RETRY_ATTEMPTS) {
          await this.sleep(LIKE_RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw lastError;
  }

  private getCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setCache<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
    ttlMs: number,
  ): void {
    cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private extractPagination(href?: string): PaginationParams | undefined {
    if (!href) {
      return undefined;
    }

    try {
      const url = new URL(href);
      const params: PaginationParams = {};
      for (const key of ['cursor', 'offset']) {
        const value = url.searchParams.get(key);
        if (value) {
          params[key] = value;
        }
      }
      return Object.keys(params).length > 0 ? params : undefined;
    } catch {
      return undefined;
    }
  }

  private async runSerially<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.syncLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);

    this.syncLocks.set(key, tail);

    await previous;

    try {
      return await fn();
    } finally {
      release();
      if (this.syncLocks.get(key) === tail) {
        this.syncLocks.delete(key);
      }
    }
  }

  private async findLikesPlaylist(token: string): Promise<ScPlaylist | null> {
    let cursor: string | undefined;

    for (;;) {
      const params: Record<string, unknown> = { limit: 200, linked_partitioning: true };
      if (cursor) params.cursor = cursor;

      const page = await this.sc.apiGet<ScPaginatedResponse<ScPlaylist>>(
        '/me/playlists',
        token,
        params,
      );

      const playlist =
        page.collection?.find((item) => item.title?.trim() === LIKES_PLAYLIST_NAME) ?? null;
      if (playlist) {
        return playlist;
      }

      if (!page.next_href) {
        return null;
      }

      const next = this.extractPagination(page.next_href);
      if (!next?.cursor || next.cursor === cursor) {
        return null;
      }

      cursor = next.cursor;
    }
  }

  private async ensureLikesPlaylist(sessionId: string, token: string): Promise<ScPlaylist> {
    const cacheKey = `likes-playlist:${sessionId}`;
    const cached = this.getCache(this.likesPlaylistCache, cacheKey);
    if (cached) {
      return cached;
    }

    const existing = await this.findLikesPlaylist(token);
    if (existing) {
      this.setCache(this.likesPlaylistCache, cacheKey, existing, PLAYLIST_CACHE_TTL_MS);
      return existing;
    }

    const created = await this.sc.apiPost<ScPlaylist>('/playlists', token, {
      playlist: {
        title: LIKES_PLAYLIST_NAME,
        sharing: 'private',
      },
    });
    this.setCache(this.likesPlaylistCache, cacheKey, created, PLAYLIST_CACHE_TTL_MS);
    this.setCache(
      this.playlistTracksCache,
      `likes-playlist-tracks:${sessionId}:${created.urn}`,
      [],
      PLAYLIST_TRACKS_CACHE_TTL_MS,
    );
    return created;
  }

  private async fetchAllPlaylistTrackUrns(token: string, playlistUrn: string): Promise<string[]> {
    let cursor: string | undefined;
    const urns: string[] = [];

    for (;;) {
      const params: Record<string, unknown> = { limit: 200, linked_partitioning: true };
      if (cursor) params.cursor = cursor;

      const page = await this.sc.apiGet<ScPaginatedResponse<ScTrack>>(
        `/playlists/${playlistUrn}/tracks`,
        token,
        params,
      );

      for (const track of page.collection ?? []) {
        if (track.urn) {
          urns.push(track.urn);
        }
      }

      if (!page.next_href) {
        return urns;
      }

      const next = this.extractPagination(page.next_href);
      if (!next?.cursor || next.cursor === cursor) {
        return urns;
      }

      cursor = next.cursor;
    }
  }

  private async getPlaylistTrackUrnsCached(
    sessionId: string,
    token: string,
    playlistUrn: string,
    forceRefresh = false,
  ): Promise<string[]> {
    const cacheKey = `likes-playlist-tracks:${sessionId}:${playlistUrn}`;
    if (!forceRefresh) {
      const cached = this.getCache(this.playlistTracksCache, cacheKey);
      if (cached) {
        return [...cached];
      }
    }

    const trackUrns = await this.fetchAllPlaylistTrackUrns(token, playlistUrn);
    this.setCache(this.playlistTracksCache, cacheKey, trackUrns, PLAYLIST_TRACKS_CACHE_TTL_MS);
    return [...trackUrns];
  }

  private invalidateLikesPlaylistCache(sessionId: string, playlistUrn?: string): void {
    this.likesPlaylistCache.delete(`likes-playlist:${sessionId}`);
    if (playlistUrn) {
      this.playlistTracksCache.delete(`likes-playlist-tracks:${sessionId}:${playlistUrn}`);
    }
  }

  private async updateLikesPlaylistTracks(
    sessionId: string,
    token: string,
    playlistUrn: string,
    trackUrns: string[],
  ): Promise<ScPlaylist> {
    const updated = await this.sc.apiPut<ScPlaylist>(`/playlists/${playlistUrn}`, token, {
      playlist: {
        tracks: trackUrns.map((urn) => ({ urn })),
      },
    });
    this.setCache(
      this.playlistTracksCache,
      `likes-playlist-tracks:${sessionId}:${playlistUrn}`,
      [...trackUrns],
      PLAYLIST_TRACKS_CACHE_TTL_MS,
    );
    this.setCache(
      this.likesPlaylistCache,
      `likes-playlist:${sessionId}`,
      updated,
      PLAYLIST_CACHE_TTL_MS,
    );
    return updated;
  }

  private async syncTrackWithLikesPlaylistOnce(
    sessionId: string,
    token: string,
    trackUrn: string,
    shouldBePresent: boolean,
  ): Promise<ScPlaylist> {
    const playlist = await this.ensureLikesPlaylist(sessionId, token);
    const existingTrackUrns = await this.getPlaylistTrackUrnsCached(sessionId, token, playlist.urn);
    const hasTrack = existingTrackUrns.includes(trackUrn);

    if ((shouldBePresent && hasTrack) || (!shouldBePresent && !hasTrack)) {
      return playlist;
    }

    const nextTrackUrns = shouldBePresent
      ? [trackUrn, ...existingTrackUrns]
      : existingTrackUrns.filter((urn) => urn !== trackUrn);

    return this.updateLikesPlaylistTracks(sessionId, token, playlist.urn, nextTrackUrns);
  }

  private async syncTrackWithLikesPlaylist(
    sessionId: string,
    token: string,
    trackUrn: string,
    shouldBePresent: boolean,
  ): Promise<ScPlaylist> {
    try {
      return await this.syncTrackWithLikesPlaylistOnce(sessionId, token, trackUrn, shouldBePresent);
    } catch {
      const cachedPlaylist = this.getCache(this.likesPlaylistCache, `likes-playlist:${sessionId}`);
      this.invalidateLikesPlaylistCache(sessionId, cachedPlaylist?.urn);

      const playlist = await this.ensureLikesPlaylist(sessionId, token);
      const existingTrackUrns = await this.getPlaylistTrackUrnsCached(
        sessionId,
        token,
        playlist.urn,
        true,
      );
      const hasTrack = existingTrackUrns.includes(trackUrn);

      if ((shouldBePresent && hasTrack) || (!shouldBePresent && !hasTrack)) {
        return playlist;
      }

      const nextTrackUrns = shouldBePresent
        ? [trackUrn, ...existingTrackUrns]
        : existingTrackUrns.filter((urn) => urn !== trackUrn);

      return this.updateLikesPlaylistTracks(sessionId, token, playlist.urn, nextTrackUrns);
    }
  }

  private async getTrackDataForFallback(
    token: string,
    trackUrn: string,
    trackData?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    if (trackData) {
      return trackData;
    }

    try {
      const scTrack = await this.sc.apiGet<ScTrack>(`/tracks/${trackUrn}`, token);
      return scTrack as unknown as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async likeTrack(
    token: string,
    sessionId: string,
    trackUrn: string,
    trackData?: Record<string, unknown>,
  ): Promise<unknown> {
    return this.runSerially(`likes-sync:${sessionId}`, async () => {
      let scLikeOk = false;
      let playlistSyncOk = false;

      try {
        await this.retryLikeTrack(token, trackUrn);
        scLikeOk = true;
      } catch {}

      try {
        await this.syncTrackWithLikesPlaylist(sessionId, token, trackUrn, true);
        playlistSyncOk = true;
      } catch {}

      if (!scLikeOk || !playlistSyncOk) {
        const fallbackTrackData = await this.getTrackDataForFallback(token, trackUrn, trackData);
        if (fallbackTrackData) {
          await this.localLikes.add(sessionId, trackUrn, fallbackTrackData);
        }
        if (!scLikeOk && !playlistSyncOk) {
          return { status: 'local' };
        }
        return { status: 'synced_with_fallback', soundcloud: scLikeOk, playlist: playlistSyncOk };
      }

      await this.localLikes.remove(sessionId, trackUrn).catch(() => undefined);
      return { status: 'ok', playlist: true };
    });
  }

  async unlikeTrack(token: string, sessionId: string, trackUrn: string): Promise<unknown> {
    return this.runSerially(`likes-sync:${sessionId}`, async () => {
      const results = await Promise.allSettled([
        this.sc.apiDelete(`/likes/tracks/${trackUrn}`, token),
        this.syncTrackWithLikesPlaylist(sessionId, token, trackUrn, false),
        this.localLikes.remove(sessionId, trackUrn),
      ]);

      if (results[0].status === 'fulfilled') return results[0].value;
      return { status: 'removed' };
    });
  }

  async isLocalLiked(sessionId: string, trackUrn: string): Promise<boolean> {
    return this.localLikes.isLiked(sessionId, trackUrn);
  }

  likePlaylist(token: string, playlistUrn: string): Promise<unknown> {
    return this.sc.apiPost(`/likes/playlists/${playlistUrn}`, token);
  }

  unlikePlaylist(token: string, playlistUrn: string): Promise<unknown> {
    return this.sc.apiDelete(`/likes/playlists/${playlistUrn}`, token);
  }

  async isPlaylistLiked(token: string, playlistUrn: string): Promise<{ liked: boolean }> {
    let cursor: string | undefined;
    for (;;) {
      const params: Record<string, unknown> = { limit: 200, linked_partitioning: true };
      if (cursor) params.cursor = cursor;
      const page = await this.sc.apiGet<ScPaginatedResponse<ScPlaylist>>(
        '/me/likes/playlists',
        token,
        params,
      );
      if (!page?.collection) break;
      if (page.collection.some((p) => p.urn === playlistUrn)) {
        return { liked: true };
      }
      if (!page.next_href) break;
      const url = new URL(page.next_href);
      cursor = url.searchParams.get('cursor') ?? undefined;
      if (!cursor) break;
    }
    return { liked: false };
  }
}
