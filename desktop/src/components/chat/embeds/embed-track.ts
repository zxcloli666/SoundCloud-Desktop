import { api } from '../../../lib/api';
import type { Embed, EmbedTrack } from '../../../lib/chat/types';
import { idOf } from '../../../lib/ids';
import { queryClient } from '../../../lib/query-client';
import { getArtistDisplay } from '../../../lib/track-display';
import { type Track, usePlayerStore } from '../../../stores/player';

const FULL_STALE_MS = 30_000;

function stubTrack(
  urn: string,
  title: string,
  artist: string,
  durationMs: number,
  artworkUrl: string | null,
): Track {
  return {
    id: Number(idOf(urn) ?? 0),
    urn,
    title,
    duration: durationMs,
    artwork_url: artworkUrl,
    user: { id: 0, urn: '', username: artist, avatar_url: '' },
  };
}

export function snapshotTrack(embed: Embed): Track {
  return {
    ...stubTrack(
      embed.urn,
      embed.title,
      embed.artist ?? '',
      embed.durationMs ?? 0,
      embed.artworkUrl,
    ),
    permalink_url: embed.permalink || undefined,
    access: (embed.access as Track['access']) ?? undefined,
  };
}

export function listTrack(item: EmbedTrack): Track {
  return stubTrack(item.urn, item.title, item.artist, item.durationMs, item.artworkUrl);
}

export function fullTrack(urn: string): Promise<Track> {
  return queryClient.fetchQuery({
    queryKey: ['track', urn],
    queryFn: () => api<Track>(`/tracks/${encodeURIComponent(urn)}`),
    staleTime: FULL_STALE_MS,
  });
}

export function useIsCurrent(urn: string): boolean {
  return usePlayerStore((s) => s.currentTrack?.urn === urn);
}

export function useIsPlaying(urn: string): boolean {
  return usePlayerStore((s) => s.currentTrack?.urn === urn && s.isPlaying);
}

export function togglePlay(track: Track, queue: Track[] = [track]): void {
  const player = usePlayerStore.getState();
  if (player.currentTrack?.urn !== track.urn) {
    player.play(track, queue);
    return;
  }
  if (player.isPlaying) player.pause();
  else player.resume();
}

export function isUnavailable(track: Track): boolean {
  return track.access === 'blocked' || getArtistDisplay(track).availability !== 'indexed';
}
