import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type Aura, auraRgb, auraRgba } from '../../../lib/aura';
import { ChartNoAxesColumn, ChevronRight } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { fillTimeline } from './stats-utils';
import { useListeningStats } from './useListeningStats';
import { useStatsFormat } from './useStatsFormat';

export const StatsTeaser = memo(function StatsTeaser({
  aura,
  genre,
}: {
  aura: Aura;
  genre?: string | null;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const fmt = useStatsFormat();
  const { data } = useListeningStats('month');
  const bars = useMemo(() => (data ? fillTimeline(data) : []), [data]);

  if (genre || !data || data.totals.plays === 0) return null;

  const max = Math.max(1, ...bars.map((b) => b.plays));
  const lead = data.topArtists[0];

  return (
    <Link
      to="/library/stats"
      className="group sp-rise relative flex items-center gap-4 p-4 pr-5 rounded-[1.75rem] overflow-hidden transition-transform duration-300 hover:scale-[1.005]"
      style={{
        border: `0.5px solid ${auraRgba(aura, 0.22)}`,
        background: `linear-gradient(120deg, ${auraRgba(aura, 0.13)}, rgba(255,255,255,0.015) 60%)`,
        boxShadow: perf.glow ? `0 0 46px ${auraRgba(aura, 0.16)}` : undefined,
        animation: 'sp-rise 620ms cubic-bezier(0.2,0.8,0.2,1) both',
      }}
    >
      <span
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
        style={{ color: auraRgb(aura), background: auraRgba(aura, 0.16) }}
      >
        <ChartNoAxesColumn size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold tracking-tight text-white/90">
          {t('stats.teaserTitle')}
        </p>
        <p className="text-[12px] text-white/45 tabular-nums truncate mt-0.5">
          {t('stats.playsCount', {
            count: data.totals.plays,
            formatted: fmt.number(data.totals.plays),
          })}
          {' · '}
          {fmt.duration(data.totals.listenedMs)}
          {lead && (
            <>
              {' · '}
              {t('stats.teaserTopArtist', { name: lead.artistName })}
            </>
          )}
        </p>
      </div>
      <div className="hidden md:flex items-end gap-[3px] h-9 w-[180px] shrink-0">
        {bars.map((b) => (
          <span
            key={b.key}
            className="flex-1 rounded-t-[2px]"
            style={{
              height: b.plays > 0 ? `${12 + (b.plays / max) * 88}%` : '6%',
              background:
                b.plays > 0
                  ? auraRgba(aura, 0.35 + 0.65 * (b.plays / max))
                  : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>
      <ChevronRight
        size={18}
        className="text-white/35 group-hover:text-white/80 transition-colors shrink-0"
      />
    </Link>
  );
});
