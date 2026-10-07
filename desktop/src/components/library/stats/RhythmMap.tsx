import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Aura, auraRgb, auraRgba } from '../../../lib/aura';
import { Calendar, Clock, Moon, Sun, Sunrise, Sunset } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
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
  aura,
  delay,
}: {
  cells: RhythmCell[];
  aura: Aura;
  delay?: number;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
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
      aura={aura}
      icon={<Clock size={14} />}
      title={t('stats.rhythm')}
      delay={delay}
      aside={
        hover && (
          <span className="text-[11.5px] text-white/60 tabular-nums truncate">
            {longDays[hover.day]}, {hourLabel(fmt.locale, hover.hour)}
            <span className="text-white/35">
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
            <span
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                color: auraRgb(aura),
                background: auraRgba(aura, 0.14),
                boxShadow: perf.glow ? `0 0 26px ${auraRgba(aura, 0.35)}` : undefined,
              }}
            >
              <KindIcon size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-[17px] font-black tracking-tight text-white/95 leading-tight">
                {t(`stats.kind.${rhythm.kind}`)}
              </p>
              <p className="text-[12px] text-white/45 mt-0.5">
                {t(`stats.kindShare.${rhythm.kind}`, {
                  percent: Math.round(rhythm.kindShare * 100),
                })}
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                <Clock size={11} />
                {t('stats.peakHour')}
              </p>
              <p className="text-[15px] font-bold text-white/85 mt-1 tabular-nums">
                {hourLabel(fmt.locale, rhythm.peakHour)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                <Calendar size={11} />
                {t('stats.peakDay')}
              </p>
              <p className="text-[15px] font-bold text-white/85 mt-1 capitalize">
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
                <span className="pr-2 text-[10px] text-white/35 leading-none self-center capitalize">
                  {shortDays[day]}
                </span>
                {row.map((plays, hour) => {
                  const level = plays / rhythm.max;
                  const isHover = hover?.day === day && hover.hour === hour;
                  return (
                    <span
                      key={hour}
                      onMouseEnter={() => setHover({ day, hour })}
                      className="aspect-square rounded-[4px] transition-transform duration-200"
                      style={{
                        background:
                          plays > 0
                            ? auraRgba(aura, 0.12 + 0.88 * level ** 0.75)
                            : 'rgba(255,255,255,0.035)',
                        boxShadow:
                          isHover || (perf.glow && level > 0.7)
                            ? `0 0 12px ${auraRgba(aura, 0.55)}`
                            : undefined,
                        transform: isHover ? 'scale(1.25)' : undefined,
                        outline: isHover ? '1px solid rgba(255,255,255,0.6)' : undefined,
                      }}
                    />
                  );
                })}
              </div>
            ))}
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span
                key={hour}
                className="pt-1.5 text-[9.5px] text-white/30 tabular-nums leading-none"
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
