import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useListeningStats } from '../components/library/stats/useListeningStats';
import { RecapStory } from '../components/recap/RecapStory';
import { usePerfMode } from '../lib/perf';
import { RECAP_MIN_PLAYS, recapYear } from '../lib/recap-window';

export const RecapPage = memo(function RecapPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useListeningStats('year');
  const year = recapYear() ?? new Date().getFullYear();
  const enough = !!data && data.totals.plays >= RECAP_MIN_PLAYS;

  return (
    <div className="relative min-h-full w-full">
      <RecapAtmosphere />
      <div
        className="relative z-10 mx-auto flex h-[calc(100vh-190px)] min-h-[480px] w-full max-w-[920px] flex-col px-4 pt-4 md:px-8"
        style={{ isolation: 'isolate' }}
      >
        {enough ? (
          <RecapStory year={year} stats={data} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="text-[22px] font-bold text-white/85">
              {isLoading ? t('common.loading') : t('recap.empty')}
            </div>
            {!isLoading && (
              <Link
                to="/home"
                className="mt-4 text-[13px] font-semibold text-accent hover:underline"
              >
                {t('recap.emptyHint')}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

const RecapAtmosphere = memo(function RecapAtmosphere() {
  const perf = usePerfMode();
  if (!perf.atmosphere) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0"
      style={{
        contain: 'strict',
        transform: 'translateZ(0)',
        background:
          'radial-gradient(60% 50% at 20% 10%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 70%), radial-gradient(55% 45% at 85% 95%, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 70%)',
      }}
    />
  );
});

export default RecapPage;
