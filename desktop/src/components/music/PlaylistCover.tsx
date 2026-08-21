import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { api } from '../../lib/api';
import { art } from '../../lib/formatters';
import { ListMusic } from '../../lib/icons';
import { rawPlaylistCover } from '../../lib/playlist-cover';

type CoverTrack = { artwork_url?: string | null };

interface Props {
  artworkUrl: string | null | undefined;
  tracks?: CoverTrack[] | null;
  /** Playlist urn — lets the cover fall back to the first track's artwork
   *  even when the list payload carries no tracks (fetched once, cached). */
  urn?: string;
  size?: string;
  /** Applied to the rendered <img> / placeholder (fills its parent box). */
  className?: string;
  iconSize?: number;
  alt?: string;
}

/** First track's artwork, fetched only when the playlist has no cover of its
 *  own and no embedded tracks to borrow from. Cached per playlist urn. */
function useFirstTrackArtwork(urn: string | undefined, enabled: boolean): string | null {
  const { data } = useQuery({
    queryKey: ['playlist', urn, 'cover-fallback'],
    queryFn: async ({ signal }) => {
      const res = await api<{ collection: CoverTrack[] }>(
        `/playlists/${encodeURIComponent(urn!)}/tracks?limit=1`,
        { signal },
      );
      return res.collection?.[0]?.artwork_url ?? null;
    },
    enabled: enabled && !!urn,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
  return data ?? null;
}

/** Shared playlist thumbnail: the playlist's cover, falling back to the first
 *  track's artwork (embedded or fetched), with a glyph placeholder when neither
 *  exists. Parent sizes and clips it; this fills the box. */
export const PlaylistCover = React.memo(function PlaylistCover({
  artworkUrl,
  tracks,
  urn,
  size = 't300x300',
  className = '',
  iconSize = 28,
  alt = '',
}: Props) {
  const direct = rawPlaylistCover(artworkUrl, tracks);
  const fetched = useFirstTrackArtwork(urn, !direct);
  const cover = art(direct ?? fetched, size);

  if (cover) {
    return (
      <img
        src={cover}
        alt={alt}
        decoding="async"
        loading="lazy"
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`w-full h-full flex items-center justify-center bg-white/[0.04] ${className}`}>
      <ListMusic size={iconSize} className="text-white/15" />
    </div>
  );
});
