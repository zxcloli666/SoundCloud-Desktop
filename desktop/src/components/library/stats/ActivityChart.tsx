import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimelineBar } from './stats-utils';
import { useStatsFormat } from './useStatsFormat';

function axisIndexes(count: number): Set<number> {
  if (count <= 12) return new Set(Array.from({ length: count }, (_, i) => i));
  const step = Math.ceil(count / 6);
  const picks = new Set<number>();
  for (let i = 0; i < count; i += step) picks.add(i);
  picks.add(count - 1);
  return picks;
}

export const ActivityChart = memo(function ActivityChart({
  bars,
  unit,
}: {
  bars: TimelineBar[];
  unit: 'day' | 'month';
}) {
  const { t } = useTranslation();
  const fmt = useStatsFormat();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.plays));
  const peak = bars.reduce((best, b, i) => (b.plays > bars[best].plays ? i : best), 0);
  const axis = useMemo(() => axisIndexes(bars.length), [bars.length]);
  const label = (b: TimelineBar) => (unit === 'day' ? fmt.day(b.date) : fmt.month(b.date));
  const axisLabel = (b: TimelineBar) => {
    if (unit === 'month') return fmt.monthShort(b.date);
    return bars.length <= 7 ? fmt.weekday(b.date) : String(b.date.getDate());
  };
  const gap = bars.length > 40 ? 2 : bars.length > 14 ? 4 : 8;
  const focus = hover ?? peak;
  const focused = bars[focus];

  if (bars.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3 min-h-[20px]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-45">
          {hover == null ? t('stats.peak') : label(focused)}
        </span>
        {focused && focused.plays > 0 && (
          <span className="text-[12px] text-ink-60 tabular-nums truncate">
            {hover == null && (
              <span className="text-ink-85 font-semibold">{label(focused)} · </span>
            )}
            {t('stats.playsCount', { count: focused.plays, formatted: fmt.number(focused.plays) })}
            <span className="text-ink-35"> · {fmt.duration(focused.listenedMs)}</span>
          </span>
        )}
      </div>
      <div className="flex items-end h-[132px]" style={{ gap }} onMouseLeave={() => setHover(null)}>
        {bars.map((b, i) => {
          const active = i === focus && b.plays > 0;
          const height = b.plays > 0 ? 8 + (b.plays / max) * 92 : 0;
          return (
            <div
              key={b.key}
              className="relative flex-1 min-w-0 h-full flex items-end cursor-default"
              onMouseEnter={() => setHover(i)}
            >
              {b.plays > 0 ? (
                <div
                  className={`w-full rounded-t-[5px] transition-colors duration-200 ${active ? 'bg-accent' : 'bg-ink/[0.16]'}`}
                  style={{
                    height: `${height}%`,
                    transformOrigin: 'bottom',
                    animation: `sp-rise 560ms cubic-bezier(0.2,0.8,0.2,1) ${Math.min(i * 0.012, 0.5).toFixed(3)}s both`,
                  }}
                />
              ) : (
                <div className="w-full h-[3px] rounded-full bg-ink/[0.07]" />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex mt-2" style={{ gap }}>
        {bars.map((b, i) => (
          <span
            key={b.key}
            className="min-w-0 flex-1 overflow-visible text-center text-[10px] whitespace-nowrap tabular-nums text-ink-35"
          >
            {axis.has(i) ? axisLabel(b) : ''}
          </span>
        ))}
      </div>
    </div>
  );
});
