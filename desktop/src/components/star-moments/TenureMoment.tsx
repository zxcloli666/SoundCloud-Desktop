import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../lib/perf';
import { usePremium } from '../../lib/premium-cache';
import { type Tenure, useOwnTenure } from '../../lib/star-tenure';
import { useStarMoments } from '../../stores/star-moments';
import { StarBadge } from '../layout/StarBadge';
import { MomentCard } from './MomentCard';

export function useTenureMoment(): (Tenure & { key: string }) | null {
  const premium = usePremium();
  const tenure = useOwnTenure();
  const seen = useStarMoments((s) => s.seen);
  if (!premium || !tenure || tenure.tier === 0) return null;
  const key = `tenure:${tenure.tier}`;
  return seen.includes(key) ? null : { ...tenure, key };
}

export const TenureMoment = memo(function TenureMoment({
  moment,
}: {
  moment: Tenure & { key: string };
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const mark = useStarMoments((s) => s.mark);

  return (
    <MomentCard onClose={() => mark(moment.key)}>
      <div className="flex items-center gap-4 pr-6">
        <div className="relative grid h-16 min-w-16 shrink-0 place-items-center">
          {perf.idleAnim && (
            <span
              aria-hidden
              className="tenure-burst absolute inset-y-0 left-1/2 aspect-square -translate-x-1/2 rounded-full"
              style={{
                border: '1.5px solid rgba(252,211,77,0.7)',
                boxShadow: '0 0 24px rgba(252,211,77,0.45)',
              }}
            />
          )}
          <StarBadge size="lg" tier={moment.tier} />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-45">
            {t('starTenure.reached')}
          </div>
          <div className="mt-0.5 text-[20px] font-bold leading-tight tracking-tight text-ink">
            {t(`starTenure.tier.${moment.tier}`)}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-40">
            {t('starTenure.months', { count: moment.months })}
          </div>
        </div>
      </div>
    </MomentCard>
  );
});
