import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw } from '../../lib/icons';
import { passDate } from '../../lib/star-format';
import { URGENT_DAYS, useStarStatus } from '../../lib/star-status';
import { useStarMoments } from '../../stores/star-moments';
import { PageLink } from '../subscription/star/LegalNote';
import { DayCells } from './DayCells';
import { MomentCard } from './MomentCard';

export interface ChargeMoment {
  key: string;
  at: number;
  days: number;
  charge: string;
}

export function useChargeMoment(): ChargeMoment | null {
  const status = useStarStatus();
  const seen = useStarMoments((s) => s.seen);
  const onStarPage = useLocation().pathname === '/star';
  if (onStarPage || status?.kind !== 'renews' || !status.soon || status.days < 1) return null;

  const key = `charge:${status.at}:${status.days <= 1 ? 1 : URGENT_DAYS}`;
  if (seen.includes(key)) return null;
  return { key, at: status.at, days: status.days, charge: status.charge };
}

export const ChargeNudge = memo(function ChargeNudge({ moment }: { moment: ChargeMoment }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mark = useStarMoments((s) => s.mark);
  const close = () => mark(moment.key);
  const manage = () => {
    close();
    navigate('/star');
  };

  return (
    <MomentCard onClose={close}>
      <div className="flex items-center gap-3.5 pr-6">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-full text-accent"
          style={{
            background: 'radial-gradient(closest-side, var(--color-accent-glow), transparent)',
          }}
        >
          <RefreshCw size={24} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-45">
            {t('starpass.manage.autoRenew')}
          </div>
          <div className="mt-0.5 text-[20px] font-bold leading-tight tracking-tight tabular-nums text-ink">
            {moment.charge}
          </div>
          <div className="mt-0.5 text-[11.5px] tabular-nums text-ink-40">
            {passDate(moment.at)} · {t('star.in', { count: moment.days })}
          </div>
        </div>
      </div>
      <DayCells total={URGENT_DAYS} left={moment.days} />
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-ink-40">
          <PageLink page="refund">{t('starpass.manage.refund')}</PageLink>
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={manage}
            className="cursor-pointer rounded-full border border-ink/[0.10] bg-ink/[0.05] px-3 py-1.5 text-[11.5px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.09] hover:text-ink"
          >
            {t('starMoments.charge.off')}
          </button>
          <button
            type="button"
            onClick={close}
            className="cursor-pointer rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold text-accent-contrast transition-transform duration-200 ease-[var(--ease-apple)] hover:-translate-y-px active:scale-[0.97]"
            style={{
              background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
              boxShadow:
                '0 0 22px -6px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.35)',
            }}
          >
            {t('starMoments.charge.keep')}
          </button>
        </span>
      </div>
    </MomentCard>
  );
});
