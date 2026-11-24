import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../../lib/api';
import { forgetOfflineLike } from '../../../lib/cache';
import { clearDislike } from '../../../lib/dislike-actions';
import { trackTasteWrite } from '../../../lib/events';
import { invalidateAllLikesCache } from '../../../lib/hooks';
import { optimisticToggleLike, setLikedUrn, useLiked } from '../../../lib/likes';
import { rememberLikedUrn } from '../../../lib/offline-index';
import { useSuperliked } from '../../../lib/superlikes';
import { HeartGlyph, HoldHeart } from '../../music/superlike/HoldHeart';
import { heartTitle } from '../../music/superlike/heart-title';
import { useSuperlikeGesture } from '../../music/superlike/useSuperlikeGesture';
import { playerBtn } from './button-class';
import { useCurrentTrackData } from './useTrackData';

function LiveLike({ trackUrn }: { trackUrn: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { trackData } = useCurrentTrackData();
  const [liked, setLiked] = useState<boolean | null>(null);
  const prevUrn = useRef(trackUrn);

  useEffect(() => {
    if (prevUrn.current === trackUrn) return;
    prevUrn.current = trackUrn;
    setLiked(null);
  }, [trackUrn]);

  useEffect(() => {
    if (trackData?.user_favorite) setLikedUrn(trackUrn, true);
  }, [trackUrn, trackData?.user_favorite]);

  const storeLiked = useLiked(trackUrn);
  const superlikedStore = useSuperliked(trackUrn, trackData?.user_superlike);
  useEffect(() => {
    if (superlikedStore) setLiked(null);
  }, [superlikedStore]);
  const isLiked = liked ?? (storeLiked || !!trackData?.user_favorite);
  const superliked = superlikedStore && isLiked;

  const toggle = async () => {
    const next = !isLiked;
    setLiked(next);
    if (trackData) optimisticToggleLike(qc, trackData, next);
    invalidateAllLikesCache();

    if (next) clearDislike(trackUrn);

    try {
      await trackTasteWrite(
        api(`/likes/tracks/${encodeURIComponent(trackUrn)}`, {
          method: next ? 'POST' : 'DELETE',
        }),
      );
      void (next ? rememberLikedUrn(trackUrn, trackData) : forgetOfflineLike(trackUrn));
      qc.invalidateQueries({ queryKey: ['track', trackUrn, 'favoriters'] });
    } catch {
      setLiked(!next);
      if (trackData) optimisticToggleLike(qc, trackData, !next);
    }
  };

  const gesture = useSuperlikeGesture(trackData ?? { urn: trackUrn }, () => void toggle());

  return (
    <button
      type="button"
      {...gesture.handlers}
      title={heartTitle(t, isLiked, superliked)}
      aria-pressed={isLiked}
      data-ui="player-like"
      className={playerBtn(isLiked)}
    >
      <HoldHeart liked={isLiked} superliked={superliked} size={16} gesture={gesture} />
    </button>
  );
}

export function LikeBtn() {
  const { t } = useTranslation();
  const { urn, usable } = useCurrentTrackData();
  if (usable) return <LiveLike key={urn} trackUrn={urn} />;
  return (
    <button
      type="button"
      disabled
      title={t('track.like')}
      aria-label={t('track.like')}
      data-ui="player-like"
      className={playerBtn(false)}
    >
      <HeartGlyph liked={false} superliked={false} size={16} />
    </button>
  );
}
