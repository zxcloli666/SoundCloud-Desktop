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
      className={`inline-flex items-center gap-2 px-3.5 h-11 rounded-2xl text-[12.5px] font-semibold border transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer active:scale-[0.96] ${
        superliked
          ? 'bg-gradient-to-r from-superlike-from/15 via-superlike-via/15 to-superlike-to/15 border-superlike-via/40 text-ink shadow-[0_0_18px_var(--color-superlike-glow)]'
          : 'bg-ink/[0.04] border-ink/[0.07] text-ink-65 hover:bg-ink/[0.07] hover:text-ink-90 hover:border-ink/[0.12]'
      }`}
    >
      <HoldHeart liked superliked size={15} gesture={gesture} />
      <span>{t('superlike.action')}</span>
    </button>
  );
});
