import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Users } from '../../../../lib/icons';
import { useSharedOverview } from '../../../../lib/star-shared';
import { useFlowApi } from '../flow/derive';
import { IconTile } from '../ui/Row';
import { SeatDots } from '../ui/SeatDots';

export const SeatsRow = memo(function SeatsRow() {
  const { t } = useTranslation();
  const owned = useSharedOverview().data?.owner;
  const api = useFlowApi();
  if (!owned) return null;
  return (
    <button
      type="button"
      data-ui="star-seats"
      onClick={() => api.setStep('plan')}
      className="flex min-h-[60px] w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.04]"
    >
      <IconTile>
        <Users size={16} />
      </IconTile>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-ink-90">
          {t(`starpass.tier.${owned.tier}`)}
        </span>
        <span className="block text-[12px] text-ink-45">
          {t('starpass.shared.seatsOf', { used: owned.members.length, seats: owned.seats })}
        </span>
      </span>
      <SeatDots used={owned.members.length} total={owned.seats} />
      <ChevronRight size={15} className="text-ink-30" />
    </button>
  );
});
