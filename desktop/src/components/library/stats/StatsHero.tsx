import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type Aura, auraRgba } from '../../../lib/aura';
import { Disc3, Headphones, Play, Users } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { ActivityChart } from './ActivityChart';
import { DeltaChip } from './DeltaChip';
import { deltaPercent, splitDuration, type TimelineBar } from './stats-utils';
import type { ListeningStats } from './useListeningStats';
import { useStatsFormat } from './useStatsFormat';

const BigTime = memo(function BigTime({ ms, aura }: { ms: number; aura: Aura }) {
  const { t } = useTranslation();
  const { hours, minutes } = splitDuration(ms);
  const fmt = useStatsFormat();
  const gradient = {
    backgroundImage: aura.nameGradient,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  } as const;
  const unit = 'text-[18px] md:text-[22px] font-bold text-white/45 ml-1 mr-3';
  return (
    <p className="flex items-baseline flex-wrap leading-none tracking-tight">
      {hours > 0 && (
        <>
          <span className="text-[56px] md:text-[76px] font-black tabular-nums" style={gradient}>
            {fmt.number(hours)}
          </span>
          <span className={unit}>{t('stats.unitHour')}</span>
        </>
      )}
      {hours < 100 && (
        <>
          <span
            className={`${hours > 0 ? 'text-[40px] md:text-[52px]' : 'text-[56px] md:text-[76px]'} font-black tabular-nums`}
            style={gradient}
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
  aura,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delta: number | null;
  aura: Aura;
}) {
  return (
    <div className="flex-1 min-w-[120px] rounded-2xl px-4 py-3.5 bg-white/[0.035] border border-white/[0.06]">
      <div className="flex items-center gap-1.5 text-white/45 mb-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[24px] font-black tabular-nums text-white/95 leading-none">
          {value}
        </span>
        <DeltaChip value={delta} aura={aura} />
      </div>
    </div>
  );
});

export const StatsHero = memo(function StatsHero({
  stats,
  bars,
  aura,
  accentGlow,
}: {
  stats: ListeningStats;
  bars: TimelineBar[];
  aura: Aura;
  accentGlow: string;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const fmt = useStatsFormat();
  const blur = perf.blur(22);
  const { totals, previous } = stats;
  const vs = t(`stats.versus.${stats.period}`);

  return (
    <section
      className="sp-rise relative overflow-hidden rounded-[2.25rem] p-6 md:p-8"
      style={{
        border: '0.5px solid rgba(255,255,255,0.1)',
        boxShadow: `0 30px 80px rgba(0,0,0,0.42), 0 0 70px ${accentGlow}`,
        animation: 'sp-rise 620ms cubic-bezier(0.2,0.8,0.2,1) both',
      }}
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          contain: 'strict',
          backdropFilter: blur > 0 ? `blur(${blur}px) saturate(150%)` : undefined,
          WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(150%)` : undefined,
          background:
            blur > 0
              ? `linear-gradient(145deg, ${auraRgba(aura, 0.12)}, rgba(12,11,16,0.55))`
              : 'rgba(14,13,18,0.92)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none rounded-[inherit]"
        style={{
          background: `radial-gradient(110% 120% at 0% -10%, ${auraRgba(aura, 0.26)}, transparent 55%), radial-gradient(80% 90% at 100% 110%, ${auraRgba(aura, 0.1)}, transparent 60%)`,
        }}
      />
      <div className="relative z-10 flex flex-col gap-7" style={{ isolation: 'isolate' }}>
        <div className="flex flex-col lg:flex-row lg:items-end gap-6">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.28em] text-white/45 font-bold mb-3">
              <Headphones size={13} />
              {t('stats.listeningTime')}
            </p>
            <BigTime ms={totals.listenedMs} aura={aura} />
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <DeltaChip
                value={deltaPercent(totals.listenedMs, previous?.listenedMs)}
                aura={aura}
              />
              {previous && previous.listenedMs > 0 && (
                <span className="text-[12px] text-white/35">{vs}</span>
              )}
            </div>
          </div>
          <div className="flex gap-3 flex-wrap lg:flex-nowrap lg:w-[480px]">
            <Tile
              icon={<Play size={12} />}
              label={t('stats.plays')}
              value={fmt.number(totals.plays)}
              delta={deltaPercent(totals.plays, previous?.plays)}
              aura={aura}
            />
            <Tile
              icon={<Disc3 size={12} />}
              label={t('stats.tracks')}
              value={fmt.number(totals.tracks)}
              delta={deltaPercent(totals.tracks, previous?.tracks)}
              aura={aura}
            />
            <Tile
              icon={<Users size={12} />}
              label={t('stats.artists')}
              value={fmt.number(totals.artists)}
              delta={deltaPercent(totals.artists, previous?.artists)}
              aura={aura}
            />
          </div>
        </div>
        <ActivityChart bars={bars} unit={stats.unit} aura={aura} />
      </div>
    </section>
  );
});
