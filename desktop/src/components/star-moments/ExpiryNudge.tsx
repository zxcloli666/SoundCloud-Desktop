import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { passDate } from '../../lib/star-format';
import { URGENT_DAYS, useStarStatus } from '../../lib/star-status';
import { useOwnTenure } from '../../lib/star-tenure';
import { useStarMoments } from '../../stores/star-moments';
import { DayCells } from './DayCells';
import { LostStreak } from './LostStreak';
import { MomentCard } from './MomentCard';
import { StarCta } from './StarCta';
import { YearCta } from './YearCta';

export interface ExpiryMoment {
  key: string;
  endsAt: number;
  days: number;
  trial: boolean;
}

/** A pass that runs out within a few days and was not waved away yet, else null. */
export function useExpiryMoment(): ExpiryMoment | null {
  const status = useStarStatus();
  const seen = useStarMoments((s) => s.seen);
  if (status?.kind !== 'ends' || status.level !== 'urgent' || status.days < 1) return null;

  const key = `expiry:${status.at}:${status.days <= 1 ? 1 : URGENT_DAYS}`;
  if (seen.includes(key)) return null;
  return { key, endsAt: status.at, days: status.days, trial: status.trial };
}

/** A few days before STAR runs out: the pass visibly burning down, one tap to extend. */
export const ExpiryNudge = memo(function ExpiryNudge({ moment }: { moment: ExpiryMoment }) {
  const { t } = useTranslation();
  const mark = useStarMoments((s) => s.mark);
  const close = () => mark(moment.key);
  const tenure = useOwnTenure();

  return (
    <MomentCard onClose={close}>
      <div className="flex items-center gap-3.5 pr-6">
        <FadingStar left={moment.days / URGENT_DAYS} />
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-45">
            {moment.trial ? t('starMoments.expiry.trial') : 'STAR'}
          </div>
          <div className="mt-0.5 text-[20px] font-bold leading-tight tracking-tight text-ink">
            {t('starMoments.expiry.left', { count: moment.days })}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-40">
            {t('starpass.until')} {passDate(moment.endsAt)}
          </div>
        </div>
      </div>
      <DayCells total={URGENT_DAYS} left={moment.days} />
      {tenure && tenure.months >= 1 && !moment.trial && <LostStreak tenure={tenure} />}
      <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2">
        <StarCta intent={moment.trial ? 'buy' : 'extend'} onOpen={close} />
        <YearCta onOpen={close} size="sm" />
      </div>
    </MomentCard>
  );
});

const FadingStar = memo(function FadingStar({ left }: { left: number }) {
  return (
    <div className="relative grid size-12 shrink-0 place-items-center">
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(closest-side, var(--color-accent-glow), transparent)',
          opacity: 0.35 + left * 0.65,
        }}
      />
      <span
        className="relative text-[30px] leading-none text-accent"
        style={{ opacity: 0.3 + left * 0.7, filter: `saturate(${0.3 + left * 0.7})` }}
      >
        ✦
      </span>
    </div>
  );
});
