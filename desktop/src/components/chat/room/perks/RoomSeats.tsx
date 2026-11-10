import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from '../../../../lib/icons';
import { FULL_ON_ART } from './perks';

export const RoomSeats = memo(function RoomSeats({
  listeners,
  capacity,
  full,
  overArt = false,
}: {
  listeners: number;
  capacity: number;
  full: boolean;
  overArt?: boolean;
}) {
  const { t } = useTranslation();
  const ratio = capacity > 0 ? Math.min(1, listeners / capacity) : 1;
  const solid = full && overArt;
  return (
    <span
      title={t('chat.room.perks.seatsOf', { value: listeners, max: capacity })}
      className="flex min-w-[44px] shrink-0 flex-col items-end gap-1"
    >
      <span
        className={`flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
          full ? 'text-amber-200' : overArt ? 'text-ink-70' : 'text-ink-45'
        } ${solid ? 'rounded-full px-1.5' : ''}`}
        style={solid ? FULL_ON_ART : undefined}
      >
        <Users size={11} />
        {listeners}/{capacity}
      </span>
      <span aria-hidden className="h-[3px] w-full overflow-hidden rounded-full bg-ink/[0.08]">
        <span
          className={`block h-full origin-left rounded-full ${full ? 'bg-amber-300' : 'bg-accent'}`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </span>
    </span>
  );
});
