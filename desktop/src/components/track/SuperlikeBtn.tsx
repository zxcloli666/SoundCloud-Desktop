import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLiked } from '../../lib/likes';
import { useSuperliked } from '../../lib/superlikes';
import type { Track } from '../../stores/player';
import { HoldHeart } from '../music/superlike/HoldHeart';
import { useSuperlikeGesture } from '../music/superlike/useSuperlikeGesture';

export const SuperlikeBtn = React.memo(function SuperlikeBtn({ track }: { track: Track }) {
  const { t } = useTranslation();
  const liked = useLiked(track.urn);
  const superliked = useSuperliked(track.urn, track.user_superlike) && liked;
  const gesture = useSuperlikeGesture(track);
  const title = superliked ? t('superlike.remove') : t('superlike.markHint');

  return (
    <button
      type="button"
      {...gesture.handlers}
      title={title}
      aria-label={title}
      aria-pressed={superliked}
      className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl border px-3.5 text-[12.5px] font-semibold transition-colors duration-200 ${
        superliked
          ? 'border-superlike-via/40 bg-gradient-to-r from-superlike-from/15 via-superlike-via/15 to-superlike-to/15 text-ink'
          : 'border-ink/[0.07] bg-ink/[0.04] text-ink-65 hover:border-ink/[0.12] hover:bg-ink/[0.07] hover:text-ink-90'
      }`}
    >
      <HoldHeart liked superliked size={15} gesture={gesture} />
      <span>{t('superlike.action')}</span>
    </button>
  );
});
