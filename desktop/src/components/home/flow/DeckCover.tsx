import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Music } from '../../../lib/icons';
import { useLyricsStore } from '../../../stores/lyrics';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { CoverFade } from '../../ui/CoverFade';
import { SceneBackground } from './scene/SceneBackground';

export const DECK_COVER_SIZE = 'min(100%, clamp(168px, min(33vw, 35vh), 320px))';

function Cover({ src, title }: { src: string | null; title: string }) {
  const { t } = useTranslation();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  return (
    <button
      type="button"
      data-ui="deck-cover"
      aria-label={t('flowRedesign.openPlayer', { title })}
      onClick={() => useLyricsStore.getState().openPanel({ rightPanelOpen: false })}
      className="relative z-[1] block size-full cursor-pointer overflow-hidden rounded-[20px] bg-ink/[0.06] shadow-[0_24px_60px_-18px_rgb(var(--shade)/calc(0.7*var(--shade-alpha)))] outline-none transition-transform duration-300 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent/70 motion-reduce:transition-none"
    >
      {src && !failed ? (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-ink-30">
          <Music size={56} aria-hidden />
        </span>
      )}
    </button>
  );
}

export function DeckFrame({ track, children }: { track: Track | null; children: ReactNode }) {
  const { t } = useTranslation();
  const playing = usePlayerStore((s) => s.isPlaying);
  const opacity = useSettingsStore((s) => s.deckCoverOpacity);
  const setOpacity = useSettingsStore((s) => s.setDeckCoverOpacity);
  const artwork = art(track?.artwork_url || track?.user?.avatar_url, 't500x500');
  return (
    <div
      data-ui="deck-frame"
      style={{ width: DECK_COVER_SIZE }}
      className="group/art relative aspect-square shrink-0"
    >
      <SceneBackground artwork={artwork} playing={playing} />
      <div className="size-full transition-opacity duration-200" style={{ opacity }}>
        {children}
      </div>
      <CoverFade
        value={opacity}
        onChange={setOpacity}
        label={t('settings.deckCoverOpacity')}
        ui="deck-cover-fade"
      />
    </div>
  );
}

export function DeckCover({ track, title }: { track: Track; title: string }) {
  const src = art(track.artwork_url || track.user?.avatar_url, 't500x500');
  return (
    <DeckFrame track={track}>
      <Cover src={src} title={title} />
    </DeckFrame>
  );
}
