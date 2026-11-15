import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '../../../../lib/hooks';
import { Plus, Trash2 } from '../../../../lib/icons';
import type { SharedMember } from '../../../../lib/pay-client';
import { passDate } from '../../../../lib/star-format';
import { userUrn } from '../../../../lib/star-shared';
import { Avatar } from '../../../ui/Avatar';
import { Btn } from '../ui/Btn';
import { Row } from '../ui/Row';

export const FreeSeat = memo(function FreeSeat() {
  const { t } = useTranslation();
  return (
    <Row
      ui="star-seat"
      icon={
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-ink/20 text-ink-35">
          <Plus size={15} />
        </span>
      }
      title={<span className="font-medium text-ink-40">{t('starpass.shared.seat.free')}</span>}
    />
  );
});

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
    <Row
      ui="star-seat"
      icon={<Avatar src={user?.avatar_url} alt={user?.username} size={36} />}
      title={user?.username ?? <span className="inline-block h-3.5 w-24 rounded bg-ink/[0.08]" />}
      tone={asking ? 'bad' : 'plain'}
      sub={
        asking
          ? t('starpass.shared.seat.removeAsk')
          : lockedUntil
            ? t('starpass.shared.seat.locked', { date: passDate(lockedUntil) })
            : t('starpass.shared.seat.joined', { date: passDate(member.joined_at) })
      }
    >
      {asking ? (
        <>
          <Btn size="sm" tone="quiet" onClick={() => setAsking(false)}>
            {t('starpass.shared.seat.removeNo')}
          </Btn>
          <Btn
            size="sm"
            tone="bad"
            disabled={busy}
            onClick={() => {
              setAsking(false);
              onRemove();
            }}
          >
            {t('starpass.shared.seat.removeYes')}
          </Btn>
        </>
      ) : (
        <button
          type="button"
          disabled={!!lockedUntil || busy}
          onClick={() => setAsking(true)}
          aria-label={t('starpass.shared.seat.remove')}
          title={t('starpass.shared.seat.remove')}
          className="grid size-8 cursor-pointer place-items-center rounded-[10px] text-ink-45 transition-colors hover:bg-bad/10 hover:text-bad disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-45"
        >
          <Trash2 size={15} />
        </button>
      )}
    </Row>
  );
});
