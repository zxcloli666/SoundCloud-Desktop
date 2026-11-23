import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChartNoAxesColumn, ChevronRight } from '../../../lib/icons';
import { fillTimeline } from './stats-utils';
import { useListeningStats } from './useListeningStats';
import { useStatsFormat } from './useStatsFormat';

export const StatsTeaser = memo(function StatsTeaser({ genre }: { genre?: string | null }) {
  const { t } = useTranslation();
  const fmt = useStatsFormat();
  const { data } = useListeningStats('month');
  const bars = useMemo(() => (data ? fillTimeline(data) : []), [data]);

  if (genre || !data || data.totals.plays === 0) return null;

  const max = Math.max(1, ...bars.map((b) => b.plays));
  const lead = data.topArtists[0];

  return (
    <Link
      to="/library/stats"
      className="panel group sp-rise flex items-center gap-4 rounded-3xl p-4 pr-5 transition-colors duration-200 hover:border-ink/[0.14] hover:bg-ink/[0.04]"
      style={{ animation: 'sp-rise 620ms cubic-bezier(0.2,0.8,0.2,1) both' }}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink/[0.06] text-ink-70">
        <ChartNoAxesColumn size={21} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold tracking-tight text-ink-90">{t('stats.teaserTitle')}</p>
        <p className="mt-0.5 truncate text-[12px] tabular-nums text-ink-45">
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
      <div className="hidden h-9 w-[180px] shrink-0 items-end gap-[3px] md:flex">
        {bars.map((b) => (
          <span
            key={b.key}
            className="flex-1 rounded-t-[2px]"
            style={{
              height: b.plays > 0 ? `${12 + (b.plays / max) * 88}%` : '6%',
              background: `rgb(var(--ink) / ${b.plays > 0 ? 0.16 + 0.44 * (b.plays / max) : 0.07})`,
            }}
          />
        ))}
      </div>
      <ChevronRight
        size={18}
        className="shrink-0 text-ink-35 transition-colors group-hover:text-ink-80"
      />
    </Link>
  );
});
