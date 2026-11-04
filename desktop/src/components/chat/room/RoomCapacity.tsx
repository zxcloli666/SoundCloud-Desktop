import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Shield, Star, Users } from '../../../lib/icons';
import { usePremium } from '../../../lib/premium-cache';
import { hasModeration } from '../../../lib/together/room-rules';
import type { RoomView } from '../../../lib/together/types';
import { isRoomHost, useTogetherStore } from '../../../stores/together';
import { StarCta } from '../../star-moments/StarCta';
import { PERK_KEYFRAMES } from './perks/keyframes';
import { roomPerks, STAR_CAPACITY, STAR_MODERATORS, seatsState } from './perks/perks';
import { SeatStrip } from './perks/SeatStrip';
import { StarMark } from './perks/StarMark';

function Count({ value, max, warn }: { value: number; max: number; warn: boolean }) {
  return (
    <span
      className={`shrink-0 text-[12px] font-semibold tabular-nums ${warn ? 'text-amber-200' : 'text-ink-50'}`}
    >
      {value}/{max}
    </span>
  );
}

function Paused({ over }: { over: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-300/[0.1] px-2 py-1.5 text-[11px] font-semibold text-amber-200">
      <Pause size={11} fill="currentColor" />
      <span className="truncate">{t('chat.room.perks.paused')}</span>
      {over && (
        <span className="ml-auto shrink-0 font-medium text-ink-45">
          {t('chat.room.perks.nobodyKicked')}
        </span>
      )}
    </div>
  );
}

function Moderators({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const perks = roomPerks(room);
  const count = room.moderators?.length ?? 0;
  const over = count > perks.modsMax;
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <Shield size={13} className="shrink-0 text-ink-35" />
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-85">
        {t('chat.room.perks.moderators')}
      </span>
      {!perks.starHost && (
        <span className="flex shrink-0 items-center gap-1 text-[10.5px] font-semibold text-accent">
          <Star size={9} fill="currentColor" />
          {STAR_MODERATORS}
        </span>
      )}
      <Count value={count} max={perks.modsMax} warn={over} />
    </div>
  );
}

export const RoomCapacity = memo(function RoomCapacity({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const host = useTogetherStore(isRoomHost);
  const premium = usePremium();
  const perks = roomPerks(room);
  const members = room.members.length;
  const state = seatsState(members, perks.capacity);
  const preview = host && !perks.starHost ? STAR_CAPACITY : null;

  return (
    <div
      data-ui="room-capacity"
      className="mt-1.5 border-t border-ink/[0.06] px-1 pt-2.5 pb-1 first:mt-0 first:border-t-0 first:pt-1"
    >
      <style>{PERK_KEYFRAMES}</style>
      <div className="flex items-center gap-2">
        {perks.starHost ? (
          <StarMark size={15} />
        ) : (
          <Users size={13} className="shrink-0 text-ink-35" />
        )}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-85">
          {t('chat.room.perks.seats', { count: perks.capacity })}
        </span>
        <Count value={members} max={perks.capacity} warn={state === 'over'} />
      </div>
      <div className="mt-2">
        <SeatStrip members={members} capacity={perks.capacity} preview={preview} />
      </div>
      {preview && (
        <div className="mt-2 flex items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-[11.5px] font-semibold text-accent">
            <Star size={10} fill="currentColor" />
            {t('chat.room.perks.withStar', { count: preview })}
          </span>
          {!premium && <StarCta size="sm" />}
        </div>
      )}
      {host && state !== 'open' && <Paused over={state === 'over'} />}
      {host && hasModeration(room) && <Moderators room={room} />}
    </div>
  );
});
