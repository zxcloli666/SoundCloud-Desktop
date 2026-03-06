import { Heart } from 'lucide-react';
import React from 'react';
import { useTrackLike } from './useTrackLike.ts';

type LikeButtonProps = {
  trackUrn: string;
  initialLiked: boolean;
  className?: string;
  stopPropagation?: boolean;
};

const LikeButtonBase = ({
  trackUrn,
  initialLiked,
  className = '',
  stopPropagation = true,
}: LikeButtonProps) => {
  const { isLiked, toggle } = useTrackLike(trackUrn, initialLiked);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) e.stopPropagation();
    toggle();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer hover:bg-white/[0.04] ${
        isLiked ? 'text-white/30' : 'text-white/30 hover:text-white/60'
      } ${className}`}
    >
      <Heart
        size={16}
        fill={isLiked ? 'currentColor' : 'none'}
        strokeWidth={isLiked ? 'none' : 2}
      />
    </button>
  );
};

export const LikeButton = React.memo(LikeButtonBase);
