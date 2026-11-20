import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { coverSrc, extractPalette, type Rgb } from '../../lib/cover-palette';
import { GalleryVerticalEnd, RefreshCw } from '../../lib/icons';
import { useAnyMomentPlaying } from '../../lib/moments/channel';
import { usePerfMode } from '../../lib/perf';
import { useSettingsStore } from '../../stores/settings';
import { GenreFilter } from '../music/soundwave/genre-filter';
import { HideListenedToggle } from '../music/soundwave/hide-listened-toggle';
import { LanguageFilter } from '../music/soundwave/language-filter';
import { Atmosphere } from '../search/Atmosphere';

export const MomentsBackdrop = React.memo(function MomentsBackdrop({
  artworkUrl,
}: {
  artworkUrl: string | null;
}) {
  const [tint, setTint] = useState<string[] | undefined>(undefined);
  useEffect(() => {
    const src = coverSrc(artworkUrl);
    if (!src) return;
    let alive = true;
    extractPalette(src).then((palette) => {
      if (alive && palette) setTint([css(palette.primary), css(palette.secondary)]);
    });
    return () => {
      alive = false;
    };
  }, [artworkUrl]);
  return <Atmosphere tint={tint} energy={0.75} />;
});

export const MomentsTopBar = React.memo(function MomentsTopBar() {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const live = useAnyMomentPlaying();
  const languages = useSettingsStore((s) => s.soundwaveLanguages);
  const setLanguages = useSettingsStore((s) => s.setSoundwaveLanguages);
  const genres = useSettingsStore((s) => s.soundwaveGenres);
  const setGenres = useSettingsStore((s) => s.setSoundwaveGenres);
  const hideListened = useSettingsStore((s) => s.soundwaveHideListened);
  const setHideListened = useSettingsStore((s) => s.setSoundwaveHideListened);

  return (
    <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-6 pt-5 md:px-8">
      <div className="flex items-center gap-2.5">
        <span
          className="mo-anim size-2 rounded-full"
          style={{
            background: live ? 'var(--color-accent)' : 'rgb(var(--ink) / 0.25)',
            boxShadow: live && perf.glow ? '0 0 8px var(--color-accent)' : undefined,
            animation: live && perf.idleAnim ? 'riv-pulse 1.6s ease-in-out infinite' : undefined,
          }}
        />
        <h1 className="text-[12px] font-bold uppercase tracking-[0.22em] text-ink-90">
          {t('moments.title')}
        </h1>
      </div>
      <div className="flex items-center gap-2" data-no-drag>
        <HideListenedToggle value={hideListened} onChange={setHideListened} />
        <GenreFilter selected={genres} onChange={setGenres} />
        <LanguageFilter selected={languages} onChange={setLanguages} />
      </div>
    </header>
  );
});

export function MomentsLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 pb-14">
      <div className="flex w-full max-w-[1080px] flex-col items-center gap-6 lg:flex-row lg:gap-14">
        <div className="aspect-square w-[min(44vh,80vw,440px)] shrink-0 animate-pulse rounded-[28px] bg-ink/[0.06] lg:w-[min(58vh,38vw,540px)]" />
        <div className="flex w-full max-w-[520px] flex-col gap-4 lg:max-w-none lg:flex-1">
          <div className="h-9 w-3/4 animate-pulse rounded-xl bg-ink/[0.06]" />
          <div className="h-4 w-1/3 animate-pulse rounded-lg bg-ink/[0.05]" />
          <div className="mt-2 h-16 w-full animate-pulse rounded-xl bg-ink/[0.04]" />
          <div className="h-11 w-56 animate-pulse rounded-full bg-ink/[0.05]" />
        </div>
      </div>
    </div>
  );
}

export function MomentsWaiting({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div data-ui="moments-empty" className="flex flex-1 items-center justify-center px-6 pb-14">
      <div className="flex max-w-[380px] flex-col items-center gap-4 text-center">
        <span
          className="flex size-16 items-center justify-center rounded-[20px] ring-1 ring-ink/[0.1]"
          style={{
            background: 'linear-gradient(160deg, var(--color-accent-glow), rgb(var(--ink) / 0.03))',
            color: 'var(--color-accent)',
          }}
        >
          <GalleryVerticalEnd size={28} />
        </span>
        <h2 className="text-[20px] font-bold text-ink-92">{t('moments.waitingTitle')}</h2>
        <p className="text-[13px] leading-snug text-ink-50">{t('moments.waitingDesc')}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 flex h-10 cursor-pointer items-center gap-2 rounded-full bg-ink/[0.08] px-5 text-[13px] font-semibold text-ink-85 ring-1 ring-ink/[0.1] transition-colors hover:bg-ink/[0.12]"
        >
          <RefreshCw size={14} />
          {t('common.retry')}
        </button>
      </div>
    </div>
  );
}

function css([r, g, b]: Rgb): string {
  return `rgb(${r} ${g} ${b})`;
}
