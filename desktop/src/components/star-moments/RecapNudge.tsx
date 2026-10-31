import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from '../../lib/icons';
import { RECAP_MIN_PLAYS, recapYear } from '../../lib/recap-window';
import { useStarMoments } from '../../stores/star-moments';
import { useListeningStats } from '../library/stats/useListeningStats';
import { MomentCard } from './MomentCard';

/** Once a year, while the recap window is open: your year is ready. */
export const RecapNudge = memo(function RecapNudge() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const seen = useStarMoments((s) => s.seen);
  const mark = useStarMoments((s) => s.mark);
  const year = recapYear();
  const key = `recap:${year}`;
  const due = !!year && !seen.includes(key);
  const { data } = useListeningStats('year', due);
  if (!due || !data || data.totals.plays < RECAP_MIN_PLAYS) return null;

  return (
    <MomentCard onClose={() => mark(key)}>
      <div className="flex items-center gap-4 pr-6">
        <span
          className="text-[34px] font-black leading-none tracking-[-0.05em] text-ink"
          style={{
            fontFamily: 'var(--font-display)',
            textShadow: '0 0 30px var(--color-accent-glow)',
          }}
        >
          {year}
        </span>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            ✦ {t('recap.title', { year })}
          </div>
          <div className="mt-0.5 text-[13.5px] font-semibold text-ink-85">{t('recap.ready')}</div>
        </div>
      </div>
      <div className="mt-3.5 flex justify-end">
        <button
          type="button"
          onClick={() => {
            mark(key);
            navigate('/recap');
          }}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-accent-contrast transition-transform duration-200 hover:-translate-y-px"
          style={{
            background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
            boxShadow:
              '0 0 22px -6px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          {t('recap.open')}
          <ArrowRight size={13} />
        </button>
      </div>
    </MomentCard>
  );
});
