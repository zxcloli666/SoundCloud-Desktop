import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Aura, auraRgba } from '../../lib/aura';
import { fc } from '../../lib/formatters';
import { Compass, Disc3, MicVocal, Sparkles } from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import { GlassHeroPanel } from '../ui/GlassHeroPanel';
import { Skeleton } from '../ui/Skeleton';

interface DiscoverHeroProps {
  aura: Aura;
  artistsCount: number | null;
  albumsCount: number | null;
  freshCount: number | null;
  isLoading: boolean;
  onSurpriseMe: () => void;
  isSurprising: boolean;
}

function DiscoverHeroImpl({
  aura,
  artistsCount,
  albumsCount,
  freshCount,
  isLoading,
  onSurpriseMe,
  isSurprising,
}: DiscoverHeroProps) {
  const { t } = useTranslation();
    const perf = usePerfMode();

  return (
    <GlassHeroPanel hasStar={false} aura={aura}>
      <div data-ui="discover-hero" className="relative p-6 md:p-12 flex flex-col lg:flex-row gap-8 lg:gap-12 items-center lg:items-stretch">
          <CompassArtifact aura={aura} idleAnim={perf.idleAnim}/>

        <div className="flex-1 min-w-0 flex flex-col justify-between gap-6 text-center lg:text-left">
          <h1
            className="text-5xl md:text-7xl lg:text-[88px] font-black leading-[0.85] tracking-tighter break-words max-w-full"
            style={{
              background: aura.nameGradient,
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
                animation: perf.idleAnim ? 'prismatic-shift 8s linear infinite' : undefined,
              filter: 'drop-shadow(0 12px 36px rgb(var(--shade) / calc(0.55 * var(--shade-alpha))))',
            }}
          >
            {t('discover.title')}
          </h1>

          <div className="flex flex-wrap items-center gap-2.5 justify-center lg:justify-start text-[11px] font-bold uppercase tracking-[0.22em] text-ink-55">
            <MetaPill
              icon={<MicVocal size={11} className="text-ink-45" />}
              text={
                artistsCount == null
                  ? t('common.loading')
                  : t('discover.metaArtists', { count: artistsCount })
              }
              loading={isLoading && artistsCount == null}
            />
            <span className="text-ink-15">·</span>
            <MetaPill
              icon={<Disc3 size={11} className="text-ink-45" />}
              text={
                albumsCount == null
                  ? t('common.loading')
                  : t('discover.metaAlbums', { count: albumsCount })
              }
              loading={isLoading && albumsCount == null}
            />
            <span className="text-ink-15">·</span>
            <MetaPill
              icon={<Sparkles size={11} style={{ color: auraRgba(aura, 0.85) }} />}
              text={
                freshCount == null
                  ? t('common.loading')
                  : t('discover.metaFresh', { count: freshCount })
              }
              loading={isLoading && freshCount == null}
              highlight
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1 justify-center lg:justify-start">
            <button
              type="button"
              onClick={onSurpriseMe}
              disabled={isSurprising}
              className="group relative overflow-hidden inline-flex items-center justify-center gap-2 px-7 h-11 rounded-full text-[13px] font-semibold text-paper cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:scale-[1.04] active:scale-[0.97] disabled:opacity-60 disabled:cursor-default disabled:hover:scale-100"
              style={{
                background: 'linear-gradient(180deg, rgb(var(--ink)), rgb(var(--ink) / 0.9))',
                border: '0.5px solid rgb(var(--ink) / 0.4)',
                boxShadow: `0 12px 32px ${auraRgba(aura, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.6)`,
              }}
            >
              <span
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[900ms]"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgb(var(--ink) / 0.45), transparent)',
                }}
              />
              <Sparkles size={14} />
              {t('discover.surpriseMe')}
            </button>
          </div>
        </div>

        <div className="hidden xl:flex flex-col gap-3 self-stretch min-w-[200px]">
          <Stat
            value={artistsCount}
            label={t('discover.statArtists')}
            icon={<MicVocal size={12} />}
            aura={aura}
            loading={isLoading && artistsCount == null}
          />
          <Stat
            value={albumsCount}
            label={t('discover.statAlbums')}
            icon={<Disc3 size={12} />}
            aura={aura}
            loading={isLoading && albumsCount == null}
          />
          <Stat
            value={freshCount}
            label={t('discover.statFresh')}
            icon={<Sparkles size={12} />}
            aura={aura}
            highlight
            loading={isLoading && freshCount == null}
          />
        </div>
      </div>
    </GlassHeroPanel>
  );
}

const MetaPill = memo(function MetaPill({
  icon,
  text,
  loading,
  highlight,
}: {
  icon: React.ReactNode;
  text: string;
  loading: boolean;
  highlight?: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-3 w-16 rounded-full" />;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${highlight ? 'text-ink-70' : ''}`}>
      {icon}
      {text}
    </span>
  );
});

const Stat = memo(function Stat({
  value,
  label,
  icon,
  aura,
  highlight,
  loading,
}: {
  value: number | null;
  label: string;
  icon: React.ReactNode;
  aura: Aura;
  highlight?: boolean;
  loading?: boolean;
}) {
    const perf = usePerfMode();
    const b = perf.blur(24);
  return (
    <div
      className="relative px-5 py-3 rounded-2xl flex items-baseline gap-2.5 transition-all duration-500 hover:scale-[1.04]"
      style={{
        background: highlight
          ? `linear-gradient(135deg, ${auraRgba(aura, 0.16)}, rgb(var(--ink) / 0.02))`
            : b > 0
                ? 'rgb(var(--ink) / 0.04)'
                : 'rgb(var(--surface-hi) / 0.9)',
        border: '0.5px solid rgb(var(--ink) / 0.08)',
          backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
        boxShadow: `inset 0 0.5px 0 rgba(255,255,255,0.08), 0 8px 24px ${auraRgba(aura, highlight ? 0.28 : 0.14)}`,
      }}
    >
      <span className="text-ink-55">{icon}</span>
      {loading || value == null ? (
        <Skeleton className="h-5 w-16 rounded-md" />
      ) : (
        <span className="text-[22px] font-black tabular-nums tracking-tight text-ink">
          {fc(value)}
        </span>
      )}
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-40">
        {label}
      </span>
    </div>
  );
});

const CompassArtifact = memo(function CompassArtifact({
                                                          aura,
                                                          idleAnim,
                                                      }: {
    aura: Aura;
    idleAnim: boolean;
}) {
  return (
    <div className="relative shrink-0 self-center lg:self-start w-[180px] h-[180px] md:w-[220px] md:h-[220px]">
      <div
        className="absolute -inset-[5px] rounded-[2.4rem] pointer-events-none overflow-hidden"
        style={{
          padding: '3px',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          filter: `drop-shadow(0 0 18px ${aura.orbs[0]}aa)`,
        }}
      >
        <div
          className="absolute -inset-[40%]"
          style={{
            background: `conic-gradient(from 0deg, ${aura.orbs[0]}, ${aura.orbs[1]}, ${aura.orbs[2]}, ${aura.orbs[0]})`,
              animation: idleAnim ? 'ring-rotate 14s linear infinite' : undefined,
          }}
        />
      </div>
      <div
        className="relative w-full h-full rounded-[2.2rem] overflow-hidden flex items-center justify-center"
        style={{
          background: `radial-gradient(120% 90% at 30% 20%, ${auraRgba(aura, 0.38)} 0%, rgb(var(--surface) / 0.4) 60%, rgb(var(--paper) / 0.7) 100%)`,
          boxShadow: `0 30px 70px ${auraRgba(aura, 0.35)}, inset 0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.16)`,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(80% 60% at 50% 0%, rgb(var(--ink) / 0.18) 0%, transparent 60%)',
            mixBlendMode: 'overlay',
          }}
        />
        <div
          className="relative text-ink"
          style={{
              animation: idleAnim ? 'ring-rotate 30s linear infinite' : undefined,
            filter: `drop-shadow(0 0 18px ${auraRgba(aura, 0.7)})`,
          }}
        >
          <Compass size={96} strokeWidth={1.2} />
        </div>
      </div>
    </div>
  );
});

export const DiscoverHero = memo(DiscoverHeroImpl);
