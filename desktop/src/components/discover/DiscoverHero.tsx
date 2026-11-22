import {memo} from 'react';
import {useTranslation} from 'react-i18next';
import {fc} from '../../lib/formatters';
import {Compass, Disc3, MicVocal, Sparkles} from '../../lib/icons';
import {GlassHeroPanel} from '../ui/GlassHeroPanel';
import {Skeleton} from '../ui/Skeleton';

interface DiscoverHeroProps {
  artistsCount: number | null;
  albumsCount: number | null;
  freshCount: number | null;
  isLoading: boolean;
  onSurpriseMe: () => void;
  isSurprising: boolean;
}

function DiscoverHeroImpl({
  artistsCount,
  albumsCount,
  freshCount,
  isLoading,
  onSurpriseMe,
  isSurprising,
}: DiscoverHeroProps) {
  const {t} = useTranslation();

  return (
    <GlassHeroPanel className="@container">
      <div
        data-ui="discover-hero"
        className="relative flex flex-col items-center gap-8 p-6 @min-[512px]:p-12 @min-[740px]:flex-row @min-[740px]:items-stretch @min-[740px]:gap-12"
      >
        <div className="flex size-[180px] shrink-0 items-center justify-center self-center rounded-[2.2rem] border border-ink/[0.09] bg-ink/[0.03] text-ink @min-[512px]:size-[220px] @min-[740px]:self-start">
          <Compass size={96} strokeWidth={1.2} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 text-center @min-[740px]:text-left">
          <h1 className="max-w-full break-words text-5xl font-black leading-[0.85] tracking-tighter text-ink @min-[512px]:text-7xl @min-[740px]:text-[88px]">
            {t('discover.title')}
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.22em] text-ink-55 @min-[740px]:justify-start">
            <MetaPill
              icon={<MicVocal size={11} className="text-ink-45" />}
              text={
                artistsCount == null
                  ? t('common.loading')
                  : t('discover.metaArtists', {count: artistsCount})
              }
              loading={isLoading && artistsCount == null}
            />
            <span className="text-ink-15">·</span>
            <MetaPill
              icon={<Disc3 size={11} className="text-ink-45" />}
              text={
                albumsCount == null
                  ? t('common.loading')
                  : t('discover.metaAlbums', {count: albumsCount})
              }
              loading={isLoading && albumsCount == null}
            />
            <span className="text-ink-15">·</span>
            <MetaPill
              icon={<Sparkles size={11} className="text-accent" />}
              text={
                freshCount == null
                  ? t('common.loading')
                  : t('discover.metaFresh', {count: freshCount})
              }
              loading={isLoading && freshCount == null}
              highlight
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 @min-[740px]:justify-start">
            <button
              type="button"
              onClick={onSurpriseMe}
              disabled={isSurprising}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent px-7 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-60"
            >
              <Sparkles size={14} />
              {t('discover.surpriseMe')}
            </button>
          </div>
        </div>

        <div className="hidden min-w-[200px] flex-col gap-3 self-stretch @min-[1000px]:flex">
          <Stat
            value={artistsCount}
            label={t('discover.statArtists')}
            icon={<MicVocal size={12} />}
            loading={isLoading && artistsCount == null}
          />
          <Stat
            value={albumsCount}
            label={t('discover.statAlbums')}
            icon={<Disc3 size={12} />}
            loading={isLoading && albumsCount == null}
          />
          <Stat
            value={freshCount}
            label={t('discover.statFresh')}
            icon={<Sparkles size={12} />}
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
  highlight,
  loading,
}: {
  value: number | null;
  label: string;
  icon: React.ReactNode;
  highlight?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-2.5 rounded-2xl border px-5 py-3 ${
        highlight ? 'border-accent/30 bg-accent/[0.06]' : 'border-ink/[0.08] bg-ink/[0.03]'
      }`}
    >
      <span className="text-ink-55">{icon}</span>
      {loading || value == null ? (
        <Skeleton className="h-5 w-16 rounded-md" />
      ) : (
        <span className="text-[22px] font-black tabular-nums tracking-tight text-ink">
          {fc(value)}
        </span>
      )}
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-40">{label}</span>
    </div>
  );
});

export const DiscoverHero = memo(DiscoverHeroImpl);
