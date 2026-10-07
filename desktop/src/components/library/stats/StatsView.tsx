import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { type Aura, auraRgba } from '../../../lib/aura';
import { ChartNoAxesColumn, Loader2 } from '../../../lib/icons';
import { SyncNotice } from '../../ui/SyncNotice';
import { PeriodSwitch } from './PeriodSwitch';
import { RhythmMap } from './RhythmMap';
import { StatsHero } from './StatsHero';
import { fillTimeline, parseLocalDate } from './stats-utils';
import { TopArtists } from './TopArtists';
import { TopTracks } from './TopTracks';
import { STATS_PERIODS, type StatsPeriod, useListeningStats } from './useListeningStats';
import { useStatsFormat } from './useStatsFormat';

function readPeriod(value: string | null): StatsPeriod {
  return STATS_PERIODS.includes(value as StatsPeriod) ? (value as StatsPeriod) : 'month';
}

const EmptyStats = memo(function EmptyStats({ aura }: { aura: Aura }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-4 text-center py-20 px-6">
      <span
        className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center"
        style={{ background: auraRgba(aura, 0.12), color: auraRgba(aura, 0.9) }}
      >
        <ChartNoAxesColumn size={28} />
      </span>
      <p className="text-[17px] font-bold text-white/85">{t('stats.emptyTitle')}</p>
      <p className="text-[13px] text-white/40 max-w-[340px]">{t('stats.emptyHint')}</p>
    </div>
  );
});

export const StatsView = memo(function StatsView({
  aura,
  accentGlow,
}: {
  aura: Aura;
  accentGlow: string;
}) {
  const { t } = useTranslation();
  const fmt = useStatsFormat();
  const [params, setParams] = useSearchParams();
  const period = readPeriod(params.get('period'));
  const query = useListeningStats(period);
  const stats = query.data;
  const bars = useMemo(() => (stats ? fillTimeline(stats) : []), [stats]);
  const setPeriod = (next: StatsPeriod) => setParams({ period: next }, { replace: true });
  const edge = stats?.unit === 'day' ? fmt.day : fmt.month;
  const range = stats
    ? `${edge(parseLocalDate(stats.from))} – ${edge(parseLocalDate(stats.to))}`
    : '';

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PeriodSwitch aura={aura} value={period} onChange={setPeriod} />
        {range && <span className="text-[12px] text-white/40 tabular-nums">{range}</span>}
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 size={30} className="animate-spin text-white/20" />
        </div>
      ) : query.isError && !stats ? (
        <div className="py-16">
          <SyncNotice
            kind="failed"
            text={t('stats.loadFailed')}
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : !stats || stats.totals.plays === 0 ? (
        <EmptyStats aura={aura} />
      ) : (
        <div
          className="flex flex-col gap-5 transition-opacity duration-300"
          style={{ opacity: query.isPlaceholderData ? 0.55 : 1 }}
        >
          <StatsHero stats={stats} bars={bars} aura={aura} accentGlow={accentGlow} />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <TopArtists artists={stats.topArtists} aura={aura} delay={0.08} />
            <TopTracks tracks={stats.topTracks} aura={aura} delay={0.14} />
          </div>
          <RhythmMap cells={stats.rhythm} aura={aura} delay={0.2} />
          <p className="text-[11px] text-white/25 text-center">{t('stats.approxNote')}</p>
        </div>
      )}
    </div>
  );
});
