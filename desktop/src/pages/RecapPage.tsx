import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useListeningStats } from '../components/library/stats/useListeningStats';
import { RecapStory } from '../components/recap/RecapStory';
import { RECAP_MIN_PLAYS, recapYear } from '../lib/recap-window';

export const RecapPage = memo(function RecapPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useListeningStats('year');
  const year = recapYear() ?? new Date().getFullYear();
  const enough = !!data && data.totals.plays >= RECAP_MIN_PLAYS;

  return (
    <div data-ui="page" data-page="recap" className="relative min-h-full w-full">
      <div className="relative mx-auto flex h-[calc(100vh-190px)] min-h-[480px] w-full max-w-[920px] flex-col px-4 pt-4 md:px-8">
        {enough ? (
          <RecapStory year={year} stats={data} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="text-[22px] font-bold text-ink-85">
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

export default RecapPage;
