import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { STATS_PERIODS, type StatsPeriod } from './useListeningStats';

export const PeriodSwitch = memo(function PeriodSwitch({
  value,
  onChange,
}: {
  value: StatsPeriod;
  onChange: (period: StatsPeriod) => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="tablist" className="chip-group">
      {STATS_PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          role="tab"
          aria-selected={period === value}
          onClick={() => onChange(period)}
          className="chip-seg px-3.5"
        >
          {t(`stats.period.${period}`)}
        </button>
      ))}
    </div>
  );
});
