import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Moon, Sun, Sunrise, Sunset } from '../../../lib/icons';
import { StatsPanel } from './StatsPanel';
import { buildRhythm, hourLabel, type ListenerKind, weekdayNames } from './stats-utils';
import type { RhythmCell } from './useListeningStats';
import { useStatsFormat } from './useStatsFormat';

const KIND_ICON: Record<ListenerKind, typeof Moon> = {
  night: Moon,
  morning: Sunrise,
  day: Sun,
  evening: Sunset,
};

const AXIS_HOURS = [0, 6, 12, 18];

export const RhythmMap = memo(function RhythmMap({
  cells,
  delay,
}: {
  cells: RhythmCell[];
  delay?: number;
}) {
  const { t } = useTranslation();
  const fmt = useStatsFormat();
  const rhythm = useMemo(() => buildRhythm(cells), [cells]);
  const shortDays = useMemo(() => weekdayNames(fmt.locale, 'short'), [fmt.locale]);
  const longDays = useMemo(() => weekdayNames(fmt.locale, 'long'), [fmt.locale]);
  const [hover, setHover] = useState<{ day: number; hour: number } | null>(null);

  if (rhythm.total === 0) return null;

  const KindIcon = KIND_ICON[rhythm.kind];
  const hovered = hover ? rhythm.grid[hover.day][hover.hour] : 0;

  return (
    <StatsPanel
      icon={<Clock size={14} />}
      title={t('stats.rhythm')}
      delay={delay}
      aside={
        hover && (
          <span className="text-[11.5px] text-ink-60 tabular-nums truncate">
            {longDays[hover.day]}, {hourLabel(fmt.locale, hover.hour)}
            <span className="text-ink-35">
              {' · '}
              {t('stats.playsCount', { count: hovered, formatted: fmt.number(hovered) })}
            </span>
          </span>
        )
      }
    >
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="xl:w-[230px] shrink-0 flex flex-row xl:flex-col gap-4 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-[220px]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink/[0.06] text-ink-70">
              <KindIcon size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-[17px] leading-tight font-bold tracking-tight text-ink-95">
                {t(`stats.kind.${rhythm.kind}`)}
              </p>
              <p className="text-[12px] text-ink-45 mt-0.5">
                {t(`stats.kindShare.${rhythm.kind}`, {
                  percent: Math.round(rhythm.kindShare * 100),
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-40">
                <Clock size={11} />
                {t('stats.peakHour')}
              </p>
              <p className="text-[15px] font-bold text-ink-85 mt-1 tabular-nums">
                {hourLabel(fmt.locale, rhythm.peakHour)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-40">
                <Calendar size={11} />
                {t('stats.peakDay')}
              </p>
              <p className="text-[15px] font-bold text-ink-85 mt-1 capitalize">
                {longDays[rhythm.peakWeekday]}
              </p>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1" onMouseLeave={() => setHover(null)}>
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: 'auto repeat(24, minmax(0, 1fr))' }}
          >
            {rhythm.grid.map((row, day) => (
              <div key={shortDays[day]} className="contents">
                <span className="pr-2 text-[10px] text-ink-35 leading-none self-center capitalize">
                  {shortDays[day]}
                </span>
                {row.map((plays, hour) => {
                  const level = plays / rhythm.max;
                  const isHover = hover?.day === day && hover.hour === hour;
                  return (
                    <span
                      key={hour}
                      onMouseEnter={() => setHover({ day, hour })}
                      className={`aspect-square rounded-[4px] ${isHover ? 'bg-accent' : ''}`}
                      style={
                        isHover
                          ? undefined
                          : {
                              background: `rgb(var(--ink) / ${plays > 0 ? (0.1 + 0.55 * level ** 0.75).toFixed(3) : 0.04})`,
                            }
                      }
                    />
                  );
                })}
              </div>
            ))}
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span
                key={hour}
                className="pt-1.5 text-[9.5px] leading-none tabular-nums text-ink-35"
              >
                {AXIS_HOURS.includes(hour) ? String(hour).padStart(2, '0') : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </StatsPanel>
  );
});
