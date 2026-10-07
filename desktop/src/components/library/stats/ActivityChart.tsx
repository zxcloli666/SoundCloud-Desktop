import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Aura, auraRgb, auraRgba } from '../../../lib/aura';
import { usePerfMode } from '../../../lib/perf';
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
  aura,
}: {
  bars: TimelineBar[];
  unit: 'day' | 'month';
  aura: Aura;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
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
  const accent = auraRgb(aura);

  if (bars.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3 min-h-[20px]">
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
          {hover == null ? t('stats.peak') : label(focused)}
        </span>
        {focused && focused.plays > 0 && (
          <span className="text-[12px] text-white/60 tabular-nums truncate">
            {hover == null && (
              <span className="text-white/85 font-semibold">{label(focused)} · </span>
            )}
            {t('stats.playsCount', { count: focused.plays, formatted: fmt.number(focused.plays) })}
            <span className="text-white/35"> · {fmt.duration(focused.listenedMs)}</span>
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
                  className="w-full rounded-t-[6px] transition-[filter,box-shadow,opacity] duration-300"
                  style={{
                    height: `${height}%`,
                    transformOrigin: 'bottom',
                    animation: `sp-rise 560ms cubic-bezier(0.2,0.8,0.2,1) ${Math.min(i * 0.012, 0.5).toFixed(3)}s both`,
                    background: `linear-gradient(180deg, ${accent}, ${auraRgba(aura, 0.14)})`,
                    opacity: hover == null || active ? 1 : 0.55,
                    boxShadow: active
                      ? `0 0 24px ${auraRgba(aura, 0.6)}, inset 0 1px 0 rgba(255,255,255,0.5)`
                      : perf.glow
                        ? `0 0 14px ${auraRgba(aura, 0.22)}, inset 0 1px 0 rgba(255,255,255,0.35)`
                        : 'inset 0 1px 0 rgba(255,255,255,0.35)',
                    filter: active ? 'brightness(1.15) saturate(1.15)' : undefined,
                  }}
                />
              ) : (
                <div className="w-full h-[3px] rounded-full bg-white/[0.07]" />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex mt-2" style={{ gap }}>
        {bars.map((b, i) => (
          <span
            key={b.key}
            className="flex-1 min-w-0 text-center text-[10px] text-white/30 tabular-nums whitespace-nowrap overflow-visible"
          >
            {axis.has(i) ? axisLabel(b) : ''}
          </span>
        ))}
      </div>
    </div>
  );
});
