import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from '../../../../lib/icons';
import { usePremium } from '../../../../lib/premium-cache';
import type { RoomPerks } from '../../../../lib/together/types';
import { StarCta } from '../../../star-moments/StarCta';
import { useRoomPopoverClose } from '../RoomPopover';

export type StarState = 'star' | 'soon' | 'free';

export function useStarState(perks: RoomPerks | undefined): StarState {
  const premium = usePremium();
  if (perks?.starHost) return 'star';
  return premium ? 'soon' : 'free';
}

export const StarSoon = memo(function StarSoon() {
  const { t } = useTranslation();
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-accent">
      <Sparkles size={11} className="shrink-0" />
      <span className="truncate">{t('chat.room.perks.starSoon')}</span>
    </span>
  );
});

export const StarAction = memo(function StarAction({ state }: { state: StarState }) {
  const close = useRoomPopoverClose();
  if (state === 'soon') return <StarSoon />;
  if (state === 'free') return <StarCta size="sm" onOpen={close} />;
  return null;
});
