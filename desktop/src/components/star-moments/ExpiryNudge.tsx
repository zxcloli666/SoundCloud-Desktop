import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePremium } from '../../lib/premium-cache';
import { daysUntil, passDate } from '../../lib/star-format';
import { usePaySubscription } from '../../lib/star-offer';
import { useStarMoments } from '../../stores/star-moments';
import { primaryEntitlement } from '../subscription/star/meta';
import { MomentCard } from './MomentCard';
import { StarCta } from './StarCta';

const WARN_DAYS = 3;

export interface ExpiryMoment {
  key: string;
  endsAt: number;
  days: number;
  trial: boolean;
}

/** A pass that runs out within a few days and was not waved away yet, else null. */
export function useExpiryMoment(): ExpiryMoment | null {
  const premium = usePremium();
  const { data } = usePaySubscription(premium);
  const seen = useStarMoments((s) => s.seen);
  if (!premium || !data) return null;

  const ent = primaryEntitlement(data.entitlements);
  if (ent?.recurring && ent.auto_renew && !ent.canceled) return null;
  const endsAt = ent?.ends_at ?? data.premium_until;
  const days = daysUntil(endsAt);
  if (days < 1 || days > WARN_DAYS) return null;

  const key = `expiry:${endsAt}:${days <= 1 ? 1 : WARN_DAYS}`;
  if (seen.includes(key)) return null;
  return { key, endsAt, days, trial: ent?.source === 'trial' };
}

/** A few days before STAR runs out: the pass visibly burning down, one tap to extend. */
export const ExpiryNudge = memo(function ExpiryNudge({ moment }: { moment: ExpiryMoment }) {
  const { t } = useTranslation();
  const mark = useStarMoments((s) => s.mark);
  const close = () => mark(moment.key);

  return (
    <MomentCard onClose={close}>
      <div className="flex items-center gap-3.5 pr-6">
        <FadingStar left={moment.days / WARN_DAYS} />
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
            {moment.trial ? t('starMoments.expiry.trial') : 'STAR'}
          </div>
          <div className="mt-0.5 text-[20px] font-bold leading-tight tracking-tight text-white">
            {t('starMoments.expiry.left', { count: moment.days })}
          </div>
          <div className="mt-0.5 text-[11.5px] text-white/40">
            {t('starpass.until')} {passDate(moment.endsAt)}
          </div>
        </div>
      </div>
      <DayCells total={WARN_DAYS} left={moment.days} />
      <div className="mt-3.5 flex justify-end">
        <StarCta intent={moment.trial ? 'buy' : 'extend'} onOpen={close} />
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

const DayCells = memo(function DayCells({ total, left }: { total: number; left: number }) {
  return (
    <div className="mt-3.5 flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{
            background: i < left ? 'var(--color-accent)' : 'rgba(255,255,255,0.08)',
            boxShadow: i < left ? '0 0 10px var(--color-accent-glow)' : undefined,
          }}
        />
      ))}
    </div>
  );
});
