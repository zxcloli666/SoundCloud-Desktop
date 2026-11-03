import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../../lib/hooks';
import { Plus, Trash2 } from '../../../lib/icons';
import type { SharedMember } from '../../../lib/pay-client';
import { passDate } from '../../../lib/star-format';
import { userUrn } from '../../../lib/star-shared';
import { Avatar } from '../../ui/Avatar';

const ROW = 'flex items-center gap-3 rounded-[14px] border px-3.5 py-2.5';

export const FreeSeat = memo(function FreeSeat() {
  const { t } = useTranslation();
  return (
    <div className={`${ROW} border-dashed border-ink/[0.14]`}>
      <span className="grid size-9 place-items-center rounded-full border border-dashed border-ink/[0.18] text-ink-35">
        <Plus size={15} />
      </span>
      <span className="text-[13px] text-ink-40">{t('starpass.shared.seat.free')}</span>
    </div>
  );
});

/** A member of the owner's plan: SC avatar and name, join date, removal with a confirm step. */
export const SeatRow = memo(function SeatRow({
  member,
  busy,
  onRemove,
}: {
  member: SharedMember;
  busy: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const user = useUser(userUrn(member.sc_user_id)).data;
  const [asking, setAsking] = useState(false);
  const lockedUntil = member.removable_at * 1000 > Date.now() ? member.removable_at : 0;

  return (
    <div className={`${ROW} border-ink/[0.08] bg-ink/[0.03]`}>
      <Avatar src={user?.avatar_url} alt={user?.username} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-ink-90">
          {user?.username ?? <span className="inline-block h-3.5 w-24 rounded bg-ink/[0.08]" />}
        </div>
        <div className="text-[11.5px] text-ink-40">
          {lockedUntil
            ? t('starpass.shared.seat.locked', { date: passDate(lockedUntil) })
            : t('starpass.shared.seat.joined', { date: passDate(member.joined_at) })}
        </div>
      </div>
      {asking ? (
        <div className="flex items-center gap-2">
          <span className="hidden text-[12px] text-ink-60 sm:inline">
            {t('starpass.shared.seat.removeAsk')}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setAsking(false);
              onRemove();
            }}
            className="cursor-pointer rounded-[10px] bg-red-500/85 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {t('starpass.shared.seat.removeYes')}
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="cursor-pointer rounded-[10px] border border-ink/[0.12] px-3 py-1.5 text-[12px] text-ink-70"
          >
            {t('starpass.shared.seat.removeNo')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!!lockedUntil || busy}
          onClick={() => setAsking(true)}
          aria-label={t('starpass.shared.seat.remove')}
          title={t('starpass.shared.seat.remove')}
          className="grid size-8 cursor-pointer place-items-center rounded-[10px] text-ink-45 transition-colors hover:bg-ink/[0.08] hover:text-red-300 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-45"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
});
