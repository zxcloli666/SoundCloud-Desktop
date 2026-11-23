import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Disc3, Headphones, Play, Users } from '../../../lib/icons';
import { ActivityChart } from './ActivityChart';
import { DeltaChip } from './DeltaChip';
import { STATS_PANEL } from './StatsPanel';
import { deltaPercent, splitDuration, type TimelineBar } from './stats-utils';
import type { ListeningStats } from './useListeningStats';
import { useStatsFormat } from './useStatsFormat';

const BigTime = memo(function BigTime({ ms }: { ms: number }) {
  const { t } = useTranslation();
  const { hours, minutes } = splitDuration(ms);
  const fmt = useStatsFormat();
  const unit = 'text-[18px] md:text-[22px] font-bold text-ink-40 ml-1 mr-3';
  return (
    <p className="flex items-baseline flex-wrap leading-none tracking-tight">
      {hours > 0 && (
        <>
          <span className="text-[56px] font-black tabular-nums text-ink md:text-[76px]">
            {fmt.number(hours)}
          </span>
          <span className={unit}>{t('stats.unitHour')}</span>
        </>
      )}
      {hours < 100 && (
        <>
          <span
            className={`${hours > 0 ? 'text-[40px] md:text-[52px]' : 'text-[56px] md:text-[76px]'} font-black tabular-nums text-ink`}
          >
            {minutes}
          </span>
          <span className={unit}>{t('stats.unitMinute')}</span>
        </>
      )}
    </p>
  );
});

const Tile = memo(function Tile({
  icon,
  label,
  value,
  delta,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delta: number | null;
}) {
  return (
    <div className="min-w-[120px] flex-1 rounded-2xl border border-ink/[0.08] bg-ink/[0.04] px-4 py-3.5">
      <div className="mb-2 flex items-center gap-1.5 text-ink-45">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[24px] leading-none font-black tabular-nums text-ink-95">
          {value}
        </span>
        <DeltaChip value={delta} />
      </div>
    </div>
  );
});

export const StatsHero = memo(function StatsHero({
  stats,
  bars,
}: {
  stats: ListeningStats;
  bars: TimelineBar[];
}) {
  const { t } = useTranslation();
  const fmt = useStatsFormat();
  const { totals, previous } = stats;
  const vs = t(`stats.versus.${stats.period}`);

  return (
    <section
      className={`${STATS_PANEL} p-6 md:p-8`}
      style={{ animation: 'sp-rise 620ms cubic-bezier(0.2,0.8,0.2,1) both' }}
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-col lg:flex-row lg:items-end gap-6">
          <div className="min-w-0 flex-1">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-45">
              <Headphones size={13} />
              {t('stats.listeningTime')}
            </p>
            <BigTime ms={totals.listenedMs} />
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <DeltaChip value={deltaPercent(totals.listenedMs, previous?.listenedMs)} />
              {previous && previous.listenedMs > 0 && (
                <span className="text-[12px] text-ink-35">{vs}</span>
              )}
            </div>
          </div>
          <div className="flex gap-3 flex-wrap lg:flex-nowrap lg:w-[480px]">
            <Tile
              icon={<Play size={12} />}
              label={t('stats.plays')}
              value={fmt.number(totals.plays)}
              delta={deltaPercent(totals.plays, previous?.plays)}
            />
            <Tile
              icon={<Disc3 size={12} />}
              label={t('stats.tracks')}
              value={fmt.number(totals.tracks)}
              delta={deltaPercent(totals.tracks, previous?.tracks)}
            />
            <Tile
              icon={<Users size={12} />}
              label={t('stats.artists')}
              value={fmt.number(totals.artists)}
              delta={deltaPercent(totals.artists, previous?.artists)}
            />
          </div>
        </div>
        <ActivityChart bars={bars} unit={stats.unit} />
      </div>
    </section>
  );
});
