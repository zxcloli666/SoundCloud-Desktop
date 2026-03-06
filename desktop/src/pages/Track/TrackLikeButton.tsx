import { Heart } from 'lucide-react';
import React from 'react';
import { useTrackLike } from '../../components/track/useTrackLike.ts';
import { toCompactCount } from '../../lib/utils.ts';

//todo: сделать нормальные, универсальные кнопки, а не плодить компоненты на все

const TrackLikeButtonBase = ({
  trackUrn,
  initialLiked,
  count,
}: {
  trackUrn: string;
  initialLiked?: boolean;
  count?: number;
}) => {
  const {
    liked,
    count: localCount,
    toggle,
  } = useTrackLike(trackUrn, initialLiked ?? false, count ?? 0);

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
        liked
          ? 'bg-accent/15 text-accent border border-accent/20 shadow-[0_0_20px_rgba(255,85,0,0.1)]'
          : 'glass hover:bg-white/[0.05] text-white/60 hover:text-white/80'
      }`}
    >
      <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
      <span className="tabular-nums">{toCompactCount(localCount)}</span>
    </button>
  );
};
export const TrackLikeButton = React.memo(TrackLikeButtonBase);
