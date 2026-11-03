import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import '../../music/superlike/superlike.css';

export const SuperlikesEmpty = memo(function SuperlikesEmpty() {
  const { t } = useTranslation();
  const perf = usePerfMode();
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span
        className={`superlike-anchor text-ink-70 ${perf.idleAnim ? 'superlike-ring-demo' : ''}`}
        style={{ width: 34, height: 34 }}
      >
        <Heart size={34} />
        <svg className="superlike-ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle className="superlike-ring-track" cx="18" cy="18" r="16" />
          <circle
            className="superlike-ring-fill"
            cx="18"
            cy="18"
            r="16"
            pathLength={100}
            style={perf.idleAnim ? undefined : { animation: 'none', strokeDashoffset: 30 }}
          />
        </svg>
      </span>
      <p className="mt-4 text-[16px] font-bold text-ink-85">{t('superlikes.emptyTitle')}</p>
      <p className="max-w-md text-[13px] leading-relaxed text-ink-45">{t('superlikes.emptyBody')}</p>
      <p className="max-w-md text-[12px] leading-relaxed text-ink-30">{t('superlikes.emptyWave')}</p>
    </div>
  );
});
