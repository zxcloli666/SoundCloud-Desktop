import { memo, type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../lib/formatters';
import { usePremium } from '../../lib/premium-cache';
import { buildRhythm, hourLabel, weekdayNames } from '../library/stats/stats-utils';
import type { ListeningStats } from '../library/stats/useListeningStats';
import { useStatsFormat } from '../library/stats/useStatsFormat';
import { StarCta } from '../star-moments/StarCta';

export type SlideKind = 'intro' | 'time' | 'artist' | 'tracks' | 'rhythm' | 'outro';

const DISPLAY = { fontFamily: 'var(--font-display)' } as const;

export function slideKinds(stats: ListeningStats): SlideKind[] {
  const kinds: SlideKind[] = ['intro', 'time'];
  if (stats.topArtists.length > 0) kinds.push('artist');
  if (stats.topTracks.length >= 3) kinds.push('tracks');
  if (stats.rhythm.length > 0) kinds.push('rhythm');
  kinds.push('outro');
  return kinds;
}

export const RecapSlide = memo(function RecapSlide({
  kind,
  year,
  stats,
  onRestart,
}: {
  kind: SlideKind;
  year: number;
  stats: ListeningStats;
  onRestart: () => void;
}) {
  if (kind === 'intro') return <IntroSlide year={year} />;
  if (kind === 'time') return <TimeSlide stats={stats} />;
  if (kind === 'artist') return <ArtistSlide stats={stats} />;
  if (kind === 'tracks') return <TracksSlide stats={stats} />;
  if (kind === 'rhythm') return <RhythmSlide stats={stats} />;
  return <OutroSlide year={year} onRestart={onRestart} />;
});

function Frame({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-2 text-center">
      {eyebrow && (
        <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.32em] text-accent">
          {eyebrow}
        </div>
      )}
      {children}
    </div>
  );
}

function Giant({
  children,
  size = 'clamp(64px, 14vw, 168px)',
}: {
  children: ReactNode;
  size?: string;
}) {
  return (
    <div
      className="font-black leading-[0.9] tracking-[-0.04em] text-ink"
      style={{ ...DISPLAY, fontSize: size, textShadow: '0 0 60px var(--color-accent-glow)' }}
    >
      {children}
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 max-w-[520px] text-[16px] leading-relaxed text-ink-60">{children}</div>
  );
}

const IntroSlide = memo(function IntroSlide({ year }: { year: number }) {
  const { t } = useTranslation();
  return (
    <Frame eyebrow="✦ SoundCloud Desktop">
      <Giant size="clamp(96px, 22vw, 260px)">{year}</Giant>
      <Sub>{t('recap.intro')}</Sub>
    </Frame>
  );
});

const TimeSlide = memo(function TimeSlide({ stats }: { stats: ListeningStats }) {
  const { t } = useTranslation();
  const fmt = useStatsFormat();
  const minutes = Math.round(stats.totals.listenedMs / 60_000);
  const days = Math.floor(minutes / 1440);
  return (
    <Frame eyebrow={t('stats.listeningTime')}>
      <Giant>{fmt.number(minutes)}</Giant>
      <div className="mt-2 font-mono text-[14px] uppercase tracking-[0.2em] text-ink-50">
        {t('recap.minutes')}
      </div>
      {days > 0 && <Sub>{t('recap.days', { count: days })}</Sub>}
    </Frame>
  );
});

const ArtistSlide = memo(function ArtistSlide({ stats }: { stats: ListeningStats }) {
  const { t } = useTranslation();
  const fmt = useStatsFormat();
  const top = stats.topArtists[0];
  const cover = art(top.artworkUrl, 't500x500');
  return (
    <Frame eyebrow={t('stats.topArtist')}>
      <div
        className="mb-7 size-[clamp(140px,22vw,220px)] overflow-hidden rounded-full bg-ink/[0.06]"
        style={{
          boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 30px 90px -20px var(--color-accent-glow)',
        }}
      >
        {cover && <img src={cover} alt="" className="size-full object-cover" draggable={false} />}
      </div>
      <Giant size="clamp(36px, 7vw, 84px)">{top.artistName}</Giant>
      <Sub>{t('stats.playsCount', { count: top.plays, formatted: fmt.number(top.plays) })}</Sub>
    </Frame>
  );
});

const TracksSlide = memo(function TracksSlide({ stats }: { stats: ListeningStats }) {
  const { t } = useTranslation();
  const fmt = useStatsFormat();
  return (
    <Frame eyebrow={t('stats.topTracks')}>
      <ol className="flex w-full max-w-[520px] flex-col gap-2.5 text-left">
        {stats.topTracks.slice(0, 5).map((track, i) => {
          const cover = art(track.artworkUrl, 't200x200');
          return (
            <li
              key={track.trackUrn}
              className="flex items-center gap-4 rounded-[16px] border border-ink/[0.08] bg-ink/[0.03] px-3 py-2.5 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
              style={{ animationDelay: `${120 + i * 110}ms` }}
            >
              <span className="w-8 text-center text-[26px] font-black text-accent" style={DISPLAY}>
                {i + 1}
              </span>
              <div className="size-11 shrink-0 overflow-hidden rounded-[9px] bg-ink/[0.06]">
                {cover && (
                  <img src={cover} alt="" className="size-full object-cover" draggable={false} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold text-ink-90">
                  {track.title}
                </div>
                <div className="truncate text-[12px] text-ink-40">{track.artistName}</div>
              </div>
              <span className="font-mono text-[11px] text-ink-40">
                {fmt.number(track.plays)}×
              </span>
            </li>
          );
        })}
      </ol>
    </Frame>
  );
});

const RhythmSlide = memo(function RhythmSlide({ stats }: { stats: ListeningStats }) {
  const { t } = useTranslation();
  const fmt = useStatsFormat();
  const rhythm = useMemo(() => buildRhythm(stats.rhythm), [stats.rhythm]);
  const day = weekdayNames(fmt.locale, 'long')[rhythm.peakWeekday];
  return (
    <Frame eyebrow={t('stats.rhythm')}>
      <Giant size="clamp(40px, 8vw, 96px)">{t(`stats.kind.${rhythm.kind}`)}</Giant>
      <Sub>
        {t(`stats.kindShare.${rhythm.kind}`, { percent: Math.round(rhythm.kindShare * 100) })}
      </Sub>
      <div className="mt-8 flex gap-10 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-40">
        <div>
          {t('stats.peakDay')}
          <div className="mt-1.5 text-[18px] normal-case tracking-normal text-ink-85">{day}</div>
        </div>
        <div>
          {t('stats.peakHour')}
          <div className="mt-1.5 text-[18px] normal-case tracking-normal text-ink-85">
            {hourLabel(fmt.locale, rhythm.peakHour)}
          </div>
        </div>
      </div>
    </Frame>
  );
});

const OutroSlide = memo(function OutroSlide({
  year,
  onRestart,
}: {
  year: number;
  onRestart: () => void;
}) {
  const { t } = useTranslation();
  const premium = usePremium();
  return (
    <Frame eyebrow="✦">
      <Giant size="clamp(80px, 18vw, 210px)">{year + 1}</Giant>
      <Sub>{t('recap.outro', { year: year + 1 })}</Sub>
      <div className="pointer-events-auto mt-8 flex flex-wrap items-center justify-center gap-3">
        <StarCta intent="gift" />
        {!premium && <StarCta />}
        <button
          type="button"
          onClick={onRestart}
          className="cursor-pointer rounded-full px-4 py-2 text-[12.5px] font-semibold text-ink-45 transition-colors hover:text-ink-85"
        >
          {t('recap.again')}
        </button>
      </div>
    </Frame>
  );
});
