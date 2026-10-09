import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Aura, auraRgba, isLight } from '../../../lib/aura';
import { STATS_PERIODS, type StatsPeriod } from './useListeningStats';

export const PeriodSwitch = memo(function PeriodSwitch({
  aura,
  value,
  onChange,
}: {
  aura: Aura;
  value: StatsPeriod;
  onChange: (period: StatsPeriod) => void;
}) {
  const { t } = useTranslation();
  const index = STATS_PERIODS.indexOf(value);
  const share = 100 / STATS_PERIODS.length;
  return (
    <div
      role="tablist"
      className="relative grid grid-cols-4 p-1 rounded-full bg-white/[0.04] border border-white/[0.06] w-full sm:w-[340px]"
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full transition-[left] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{
          left: `calc(${index * share}% + 4px)`,
          width: `calc(${share}% - 8px)`,
          background: `radial-gradient(125% 125% at 30% 22%, ${aura.orbs[1]}, ${aura.orbs[0]} 70%)`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.2), 0 6px 22px ${auraRgba(aura, 0.45)}`,
        }}
      />
      {STATS_PERIODS.map((period) => {
        const active = period === value;
        return (
          <button
            key={period}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(period)}
            className={`relative z-10 py-2 text-[12.5px] font-bold rounded-full cursor-pointer transition-colors duration-300 ${
              active ? '' : 'text-white/45 hover:text-white/85'
            }`}
            style={active ? { color: isLight(aura) ? '#0a0a0c' : '#fff' } : undefined}
          >
            {t(`stats.period.${period}`)}
          </button>
        );
      })}
    </div>
  );
});
