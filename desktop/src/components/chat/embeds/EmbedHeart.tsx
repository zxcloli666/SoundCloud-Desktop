import { useQueryClient } from '@tanstack/react-query';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { setTrackLiked } from '../../../lib/like-toggle';
import { setLikedUrn, useLiked } from '../../../lib/likes';
import { useSuperliked } from '../../../lib/superlikes';
import type { Track } from '../../../stores/player';
import { HoldHeart } from '../../music/superlike/HoldHeart';
import { heartLabel, heartTitle } from '../../music/superlike/heart-title';
import { useSuperlikeGesture } from '../../music/superlike/useSuperlikeGesture';
import { fullTrack } from './embed-track';

interface EmbedHeartProps {
  urn: string;
  live: Track | null;
}

export const EmbedHeart = memo(function EmbedHeart({ urn, live }: EmbedHeartProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const liked = useLiked(urn);
  const superliked = useSuperliked(urn, live?.user_superlike) && liked;

  useEffect(() => {
    if (live?.user_favorite) setLikedUrn(urn, true);
  }, [urn, live?.user_favorite]);

  const gesture = useSuperlikeGesture(live ?? { urn }, (event) => {
    event.stopPropagation();
    void (async () => {
      const track = live ?? (await fullTrack(urn).catch(() => null));
      if (track) await setTrackLiked(qc, track, !liked);
    })();
  });

  return (
    <button
      type="button"
      {...gesture.handlers}
      aria-label={heartLabel(t, liked, superliked)}
      aria-pressed={liked}
      title={heartTitle(t, liked, superliked)}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-200 cursor-pointer ${
        liked ? 'text-accent' : 'text-ink-45 hover:bg-ink/[0.08] hover:text-ink-90'
      }`}
    >
      <HoldHeart liked={liked} superliked={superliked} size={14} gesture={gesture} />
    </button>
  );
});
