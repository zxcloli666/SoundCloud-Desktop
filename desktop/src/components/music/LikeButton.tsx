import { useQueryClient } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { Heart } from '../../lib/icons';
import { setTrackLiked } from '../../lib/like-toggle';
import { setLikedUrn, useLiked } from '../../lib/likes';
import type { Track } from '../../stores/player';

export const LikeButton = React.memo(function LikeButton({
  track,
  variant = 'inline',
}: {
  track: Track;
  variant?: 'overlay' | 'inline';
}) {
  const liked = useLiked(track.urn);

  // Seed from API data when available
  useEffect(() => {
    if (track.user_favorite) setLikedUrn(track.urn, true);
  }, [track.urn, track.user_favorite]);
  const qc = useQueryClient();

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    void setTrackLiked(qc, track, !liked);
  };

  if (variant === 'overlay') {
    return (
      <button
        type="button"
        onClick={toggle}
        className={`cursor-pointer absolute top-2 left-2 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 ${
          liked
            ? 'bg-accent/80 text-accent-contrast'
            : 'bg-black/50 text-white/80 hover:text-white hover:bg-black/70'
        }`}
      >
        <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0 ${
        liked ? 'text-accent' : 'text-white/20 hover:text-white/50'
      }`}
    >
      <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
});
